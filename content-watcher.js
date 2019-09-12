#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const https = require("https")
const process = require("process")

let fileHashes = new Map()
const IGNORE_DIRS = ["node_modules", ".git"]
const WATCHED_EXTS = [".jsx", ".js"]

function putUpdate(path) {
  const data = JSON.stringify({
    relative_path: path,
    contents: fs.readFileSync(path).toString()
  })

  const options = {
    hostname: process.env.SERVER_URL || "train.skillerwhale.com",
    port: process.env.SERVER_PORT || "443",
    protocol: "https:",
    path: `/attendances/${process.env.ATTENDANCE_ID}/file_snapshots`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length
    }
  }

  const req = https.request(options, res => {
    console.log(`status: ${res.statusCode}`)

    res.on("data", d => {
      process.stdout.write(d)
    })
  })

  req.on("error", error => {
    console.error(error)
  })
  req.write(data)
  req.end()
}

function hashFile(path) {
  const hasher = crypto.createHash("sha256")
  hasher.update(fs.readFileSync(path))
  return hasher.digest("hex")
}

const pollDirectoryForChanges = dirPath => {
  if (IGNORE_DIRS.includes(path.basename(dirPath))) return
  const files = fs.readdirSync(dirPath)
  files.forEach(file => {
    const newPath = path.join(dirPath, file)
    const stats = fs.statSync(newPath)
    if (stats.isDirectory()) {
      pollDirectoryForChanges(newPath)
    } else {
      if (WATCHED_EXTS.includes(path.extname(newPath))) {
        const currentHash = hashFile(newPath)
        if (fileHashes.has(newPath)) {
          const oldHash = fileHashes.get(newPath)
          if (oldHash !== currentHash) {
            console.log(`file changed ${newPath}`)
            putUpdate(newPath)
          }
        }
        fileHashes.set(newPath, currentHash)
      }
    }
  })
}

const pollerFunction = () => {
  pollDirectoryForChanges(".")
  setTimeout(pollerFunction, 1000)
}

pollerFunction()
