import pg from 'pg'
const { Client } = pg

const client = new Client({
  connectionString: process.argv[2],
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const res = await client.query(
  "INSERT INTO organisations (id, name) VALUES (gen_random_uuid(), 'FieldSightAI') ON CONFLICT DO NOTHING RETURNING id, name"
)

if (res.rows.length > 0) {
  console.log('Created organisation:', res.rows[0])
} else {
  console.log('Organisation already exists — nothing inserted')
}

await client.end()
