#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const https = require("https")
const process = require("process")

let fileHashes = new Map()
const IGNORE_DIRS = ["node_modules", ".git"]
const WATCHED_EXTS = [".jsx", ".js", ".html"]
var firstPass = true

const hostName = process.env.SERVER_URL || "train.skillerwhale.com"
const serverPort = process.env.SERVER_PORT || "443"

const changed_files = []

function postRequestOptions(path, headers) {
  return {
    hostname: hostName,
    port: serverPort,
    protocol: "https:",
    path: path,
    method: "POST",
    headers: headers,
  }
}

const pingOptions = postRequestOptions(
  `/attendances/${process.env.ATTENDANCE_ID}/pings`, {})

function sendPing() {
  const req = https.request(pingOptions)
  req.end()
}

function putUpdate(path) {
  if(!changed_files.includes(path)) {
    changed_files.push(path)
  }
}

function uploadFile(path) {
  process.stdout.write(`uploading: ${path}\n`)
  const data = JSON.stringify({
    relative_path: path,
    contents: fs.readFileSync(path).toString()
  })
  const options = postRequestOptions(
    `/attendances/${process.env.ATTENDANCE_ID}/file_snapshots`,
    {
      "Content-Type": "application/json",
      "Content-Length": data.length
    }
  )

  const req = https.request(options, res => {
    process.stdout.write(`status: ${res.statusCode}\n`)

    res.on("data", d => {
      process.stdout.write(d)
      process.stdout.write("\n")
    })

    // 1xx and 2xx status codes are successful for our purposes
    if(res.statusCode < 300) {
      this_index = changed_files.indexOf(path)
      if(this_index >= 0) {
        changed_files.splice(this_index, 1)
      }
    }
  })

  req.on("error", error => {
    console.error(error)
  })
  req.write(data)
  req.end()
}

function uploadChangedFiles() {
  // Iterate over a copy so the indexes don't change as we modify the array
  changed_files_copy = [...changed_files]

  changed_files_copy.forEach(function(path) {
    uploadFile(path)
  })
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
        if (!firstPass) {
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
  // Set the timeout first, to ensure an exception doesn't stop the recursion
  setTimeout(pollerFunction, 1000)
  sendPing()
  pollDirectoryForChanges(".")
  firstPass = false
}

const uploaderFunction = () => {
  // Set the timeout first, to ensure an exception doesn't stop the recursion
  setTimeout(uploaderFunction, 1000)
  uploadChangedFiles()
}

pollerFunction()
uploaderFunction()
