import os
from supabase import create_client

url = "https://api.sinfimac.pe"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc"
supabase = create_client(url, key)

res = supabase.table('tickets').select('*').eq('client_ticket_number', 'MB015146.26').execute()
print("Ticket:", res.data)

if res.data:
    ticket_id = res.data[0]['id']
    costs = supabase.table('ticket_costs').select('*').eq('ticket_id', ticket_id).execute()
    print("Costs:", costs.data)
