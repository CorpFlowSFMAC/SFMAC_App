#!/usr/bin/env python3
"""
Script de diagnóstico avanzado para PostgreSQL de SINFIMAC
"""
import psycopg2
from psycopg2 import sql
import sys
import re
import os

# Lista extendida de bases de datos a probar
DATABASES = [
    # Formato Supabase estándar: projectref$default
    {'database': 'postgres'},
    {'database': 'default$default'},
    # Nombres comunes
    {'database': 'supabase'},
    {'database': 'app'},
    {'database': 'sfmac'},
    {'database': 'db'},
    {'database': 'prod'},
    {'database': 'production'},
    {'database': 'main'},
    {'database': 'application'},
]

DB_CONFIG_BASE = {
    'host': '87.99.137.96',
    'port': 5432,
    'user': 'postgres',
    'password': 'CorpFlowSFMAC_DB_2026',
    'connect_timeout': 10
}

def try_connect(db_name, extra_options=None):
    """Intentar conectar a una base de datos específica"""
    config = {**DB_CONFIG_BASE, 'database': db_name}
    if extra_options:
        config.update(extra_options)
    try:
        conn = psycopg2.connect(**config)
        conn.autocommit = True
        return conn
    except Exception as e:
        return None, str(e)

def main():
    print('🔍 Buscando base de datos válida...\n')
    
    conn = None
    db_name = None
    last_error = None
    
    for db in DATABASES:
        db_name = db['database']
        print(f'Probando: {db_name}...', end=' ')
        conn, error = try_connect(db_name)
        if conn:
            print(f'✅')
            break
        else:
            print(f'❌ ({error[:50]}...)')
            last_error = error
    
    # Si no funcionó, probar con opciones adicionales
    if not conn:
        print('\n🔄 Probando con opciones adicionales...')
        
        # Probar con sslmode
        for db in DATABASES:
            db_name = db['database']
            print(f'Probando con sslmode=require: {db_name}...', end=' ')
            conn, error = try_connect(db_name, {'sslmode': 'require'})
            if conn:
                print(f'✅')
                break
            else:
                print(f'❌')
        
        # Probar con sslmode=disable
        if not conn:
            for db in DATABASES:
                db_name = db['database']
                print(f'Probando con sslmode=disable: {db_name}...', end=' ')
                conn, error = try_connect(db_name, {'sslmode': 'disable'})
                if conn:
                    print(f'✅')
                    break
                else:
                    print(f'❌')
    
    if not conn:
        print(f'\n❌ No se pudo conectar a ninguna base de datos')
        print(f'Último error: {last_error}')
        return

    print(f'\n✅ Conectado exitosamente a: {db_name}\n')
    cursor = conn.cursor()

    # 1. Listar TODAS las tablas públicas
    print('📊 TODAS LAS TABLAS PÚBLICAS\n')
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    tables = [row[0] for row in cursor.fetchall()]
    print('Tablas:', ', '.join(tables) if tables else 'Ninguna')

    # 2. Buscar tablas relacionadas con tickets
    ticket_tables = [t for t in tables if 'ticket' in t.lower() or 'cost' in t.lower()]
    if ticket_tables:
        print(f'\n📋 Tablas relacionadas con tickets: {", ".join(ticket_tables)}')
        
        for table in ticket_tables:
            print(f'\n  📋 Estructura de {table}:')
            try:
                cursor.execute(f"""
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}' 
                    ORDER BY ordinal_position;
                """)
                for col in cursor.fetchall():
                    nullable = '' if col[2] == 'YES' else 'NOT NULL'
                    print(f'    - {col[0]}: {col[1]} {nullable}')
                
                # Índices
                print(f'\n  📇 Índices en {table}:')
                cursor.execute(f"""
                    SELECT indexname, indexdef 
                    FROM pg_indexes 
                    WHERE tablename = '{table}';
                """)
                indexes = cursor.fetchall()
                if indexes:
                    for idx in indexes:
                        print(f'    - {idx[0]}')
                else:
                    print(f'    (ninguno)')
                
                # Conteo
                cursor.execute(f'SELECT COUNT(*) FROM {table};')
                count = cursor.fetchone()[0]
                print(f'\n  📊 Registros en {table}: {count}')
                
            except Exception as e:
                print(f'    Error: {e}')

    # 3. Buscar funciones RPC
    print('\n🔧 Funciones RPC disponibles:')
    cursor.execute("""
        SELECT proname 
        FROM pg_proc 
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ORDER BY proname;
    """)
    funcs = [row[0] for row in cursor.fetchall()]
    print('Funciones:', ', '.join(funcs) if funcs else 'Ninguna')
    
    # Filtrar las de tickets
    ticket_funcs = [f for f in funcs if 'ticket' in f.lower()]
    if ticket_funcs:
        print(f'\n🔧 Funciones relacionadas con tickets: {", ".join(ticket_funcs)}')
        for func_name in ticket_funcs:
            cursor.execute(f"""
                SELECT prosrc FROM pg_proc WHERE proname = '{func_name}'
            """)
            result = cursor.fetchone()
            if result:
                src = result[0]
                print(f'\n  - {func_name}:')
                if src and len(src) > 200:
                    print(f'    {src[:200]}...')
                else:
                    print(f'    {src}')

    cursor.close()
    conn.close()
    print('\n\n✅ Diagnóstico completado')

if __name__ == '__main__':
    main()