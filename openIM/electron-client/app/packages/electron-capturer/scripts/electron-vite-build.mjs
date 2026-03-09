import { build } from 'electron-vite'

async function run() {
  await build({ root: process.cwd() })
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
