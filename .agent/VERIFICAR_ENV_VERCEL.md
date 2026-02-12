# ⚙️ Guía: Verificar Variables de Entorno en Vercel

**Fecha:** 2026-02-12  
**Proyecto:** SFMAC Platform

---

## 🎯 Objetivo

Verificar que las variables de entorno de Supabase estén correctamente configuradas en Vercel para que la aplicación en producción pueda conectarse a la base de datos.

---

## 📋 Variables Requeridas

Tu aplicación necesita estas dos variables de entorno:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**⚠️ Importante:** El prefijo `NEXT_PUBLIC_` es necesario para que Next.js exponga estas variables al navegador.

---

## 🔍 PASO 1: Acceder a Vercel Dashboard

### 1.1. Abrir Vercel Dashboard

1. **Abre tu navegador** (Chrome, Edge, Firefox)

2. **Navega a:**
   ```
   https://vercel.com/dashboard
   ```

3. **Inicia sesión** si es necesario
   - Usa tu cuenta de GitHub, GitLab, Bitbucket o email

4. **Espera a que cargue** el dashboard

**Resultado esperado:**
Deberías ver una lista de tus proyectos de Vercel.

---

## 🔍 PASO 2: Seleccionar tu Proyecto

### 2.1. Encontrar el Proyecto

1. **Busca tu proyecto** en la lista
   - Nombre probable: `sfmac-platform`, `corpflowsfmac`, o similar
   - Busca el proyecto que está conectado a tu repositorio de GitHub

2. **Haz clic** en el nombre del proyecto

**Resultado esperado:**
Se abrirá la página de overview del proyecto mostrando los deployments recientes.

---

## 🔍 PASO 3: Acceder a Settings

### 3.1. Ir a Configuración

1. **Busca el menú de navegación** en la parte superior
   - Verás pestañas como: Overview, Deployments, Analytics, Settings, etc.

2. **Haz clic en "Settings"**

**Resultado esperado:**
Se abrirá la página de configuración del proyecto con un menú lateral.

---

## 🔍 PASO 4: Verificar Environment Variables

### 4.1. Acceder a Variables de Entorno

1. **En el menú lateral de Settings**, busca:
   ```
   Environment Variables
   ```

2. **Haz clic** en "Environment Variables"

**Resultado esperado:**
Verás una lista de todas las variables de entorno configuradas para tu proyecto.

### 4.2. Verificar Variables de Supabase

**Busca estas dos variables:**

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
```
Nombre: NEXT_PUBLIC_SUPABASE_URL
Valor: https://xqnghcdndqicqofnxvuf.supabase.co
Entornos: Production, Preview, Development (todos marcados)
```

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Nombre: NEXT_PUBLIC_SUPABASE_ANON_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (clave larga)
Entornos: Production, Preview, Development (todos marcados)
```

---

## ✅ Checklist de Verificación

Marca cada ítem cuando lo verifiques:

### Variables Configuradas
- [ ] `NEXT_PUBLIC_SUPABASE_URL` existe
- [ ] El valor es: `https://xqnghcdndqicqofnxvuf.supabase.co`
- [ ] Está habilitada para **Production**
- [ ] Está habilitada para **Preview**
- [ ] Está habilitada para **Development**

- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` existe
- [ ] El valor es una clave JWT larga (empieza con `eyJ...`)
- [ ] Está habilitada para **Production**
- [ ] Está habilitada para **Preview**
- [ ] Está habilitada para **Development**

---

## ❌ Si las Variables NO Existen

### Opción A: Agregar Variables Manualmente

1. **En la página de Environment Variables**, haz clic en:
   ```
   Add New
   ```

2. **Para la primera variable:**
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://xqnghcdndqicqofnxvuf.supabase.co
   Environments: ✓ Production  ✓ Preview  ✓ Development
   ```
   - Haz clic en **Save**

3. **Para la segunda variable:**
   ```
   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: [pega tu anon key de Supabase]
   Environments: ✓ Production  ✓ Preview  ✓ Development
   ```
   - Haz clic en **Save**

### Opción B: Obtener las Claves de Supabase

Si no tienes las claves a mano:

1. **Ve a Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/xqnghcdndqicqofnxvuf
   ```

2. **Haz clic en el ícono de Settings** (⚙️) en el menú lateral

3. **Haz clic en "API"**

4. **Copia las claves:**
   - **Project URL:** `https://xqnghcdndqicqofnxvuf.supabase.co`
   - **anon/public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

5. **Vuelve a Vercel** y agrega las variables como se indicó arriba

---

## 🚀 PASO 5: Forzar Nuevo Deployment

**⚠️ Importante:** Después de agregar o modificar variables de entorno, debes forzar un nuevo deployment para que los cambios surtan efecto.

### Opción 1: Desde Vercel Dashboard

1. **Ve a la pestaña "Deployments"**

2. **Encuentra el último deployment**

3. **Haz clic en los tres puntos** (⋮) a la derecha

4. **Selecciona "Redeploy"**

5. **Confirma** haciendo clic en "Redeploy" nuevamente

### Opción 2: Desde Git (Recomendado)

Ejecuta estos comandos en tu terminal:

```powershell
# Crear un commit vacío para forzar deployment
git commit --allow-empty -m "chore: update environment variables"

# Push a GitHub (esto activará automáticamente Vercel)
git push origin main
```

---

## 🔍 PASO 6: Verificar el Deployment

### 6.1. Esperar el Deployment

1. **Ve a la pestaña "Deployments"** en Vercel

2. **Espera** a que el nuevo deployment termine
   - Estado inicial: "Building..."
   - Estado final: "Ready" ✅

3. **Tiempo estimado:** 2-5 minutos

### 6.2. Verificar Logs

1. **Haz clic** en el deployment reciente

2. **Ve a la pestaña "Build Logs"**

3. **Verifica que no haya errores:**
   - ✅ "Collecting page data"
   - ✅ "Generating static pages"
   - ✅ "Finalizing page optimization"
   - ✅ "Build Completed"

### 6.3. Verificar Variables en Build

**Busca en los logs** algo como:
```
Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL: https://xqnghcdndqicqofnxvuf.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ey*** (hidden)
```

**⚠️ Nota:** La anon key se mostrará parcialmente oculta por seguridad.

---

## 🌐 PASO 7: Probar en Producción

### 7.1. Abrir la Aplicación

1. **Copia la URL de producción** desde Vercel
   - Generalmente es: `https://[tu-proyecto].vercel.app`

2. **Abre la URL** en tu navegador

3. **Espera a que cargue** completamente

### 7.2. Verificar Conexión a Supabase

1. **Abre la consola del navegador:**
   - Presiona `F12`
   - Ve a la pestaña "Console"

2. **Busca errores de Supabase:**
   - ❌ Si ves: `"supabaseUrl is required"` → Las variables NO están configuradas
   - ❌ Si ves: `"supabaseKey is required"` → Las variables NO están configuradas
   - ✅ Si NO ves errores → Las variables están correctas

3. **Verifica que los datos se carguen:**
   - Ve a la sección de clientes
   - Deberías ver los clientes de Supabase
   - Si ves datos → ✅ Conexión exitosa

### 7.3. Verificar en Network Tab

1. **En DevTools**, ve a la pestaña "Network"

2. **Recarga la página** (F5)

3. **Busca peticiones a Supabase:**
   - Deberías ver URLs como: `https://xqnghcdndqicqofnxvuf.supabase.co/rest/v1/...`
   - Estado: `200 OK` ✅

4. **Haz clic en una petición** y verifica:
   - Headers → `apikey: eyJ...` (tu anon key)
   - Response → Datos JSON de Supabase

---

## 📊 Resumen de Estados

### ✅ Todo Correcto
```
✅ Variables configuradas en Vercel
✅ Deployment exitoso
✅ Build sin errores
✅ Aplicación carga correctamente
✅ Datos de Supabase se muestran
✅ No hay errores en consola
```

### ⚠️ Variables Faltantes
```
❌ Variables no configuradas en Vercel
→ Solución: Agregar variables (Paso 4)
→ Luego: Forzar deployment (Paso 5)
```

### ⚠️ Variables Incorrectas
```
❌ Error en consola: "Invalid API key"
→ Solución: Verificar que la anon key sea correcta
→ Copiar de nuevo desde Supabase Dashboard
```

### ⚠️ Deployment Fallido
```
❌ Build logs muestran errores
→ Solución: Revisar logs específicos
→ Verificar que el código compile localmente: npm run build
```

---

## 🛠️ Comandos Útiles

### Verificar Build Local
```powershell
# Limpiar caché
Remove-Item -Recurse -Force .next

# Build de producción
npm run build

# Si el build falla localmente, también fallará en Vercel
```

### Verificar Variables Localmente
```powershell
# Crear archivo .env.local (solo para testing local)
@"
NEXT_PUBLIC_SUPABASE_URL=https://xqnghcdndqicqofnxvuf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu-anon-key]
"@ | Out-File -FilePath .env.local -Encoding utf8

# Ejecutar en modo desarrollo
npm run dev
```

**⚠️ Importante:** NO subas `.env.local` a Git (ya está en `.gitignore`)

---

## 📞 Troubleshooting

### Problema 1: "No puedo ver las variables en Vercel"

**Posibles causas:**
- No tienes permisos de administrador en el proyecto
- Estás viendo el proyecto equivocado

**Solución:**
- Verifica que seas el owner del proyecto
- Verifica que el proyecto esté conectado al repositorio correcto

### Problema 2: "Las variables están configuradas pero la app no funciona"

**Posibles causas:**
- El deployment no se ejecutó después de agregar las variables
- Las variables tienen valores incorrectos
- Hay un error de código que impide la conexión

**Solución:**
1. Forzar un nuevo deployment (Paso 5)
2. Verificar los valores de las variables
3. Revisar los build logs en Vercel

### Problema 3: "Build falla en Vercel pero funciona local"

**Posibles causas:**
- Variables de entorno faltantes
- Dependencias no instaladas correctamente
- Errores de TypeScript no detectados localmente

**Solución:**
1. Ejecutar `npm run build` localmente
2. Revisar errores de TypeScript
3. Verificar que todas las dependencias estén en `package.json`

---

## ✅ Checklist Final

Marca cuando completes cada paso:

- [ ] Accedí a Vercel Dashboard
- [ ] Encontré mi proyecto
- [ ] Accedí a Settings → Environment Variables
- [ ] Verifiqué que `NEXT_PUBLIC_SUPABASE_URL` existe
- [ ] Verifiqué que `NEXT_PUBLIC_SUPABASE_ANON_KEY` existe
- [ ] Ambas variables están habilitadas para Production
- [ ] Forcé un nuevo deployment
- [ ] El deployment terminó exitosamente
- [ ] Abrí la app en producción
- [ ] Los datos de Supabase se cargan correctamente
- [ ] No hay errores en la consola del navegador

---

## 🎯 Resultado Esperado

Al finalizar esta verificación, deberías tener:

✅ **Variables de entorno configuradas en Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL` = `https://xqnghcdndqicqofnxvuf.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `[tu-anon-key]`

✅ **Deployment exitoso:**
- Build sin errores
- Estado: "Ready"

✅ **Aplicación funcionando:**
- Carga correctamente
- Se conecta a Supabase
- Muestra datos de producción

---

**Última actualización:** 2026-02-12 08:14:00 (UTC-5)
