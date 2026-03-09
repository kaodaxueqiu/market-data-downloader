import { createServer } from 'electron-vite'

async function run() {
  await createServer({ root: process.cwd() }, { rendererOnly: false })
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
