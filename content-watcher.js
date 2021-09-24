#!/usr/bin/env node

const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const https = require("https")
const process = require("process")

const fileHashes = new Map()
const IGNORE_DIRS = ["node_modules", ".git"]
const WATCHED_EXTS = [".jsx", ".js", ".html"]
let firstPass = true

const hostName = process.env.SERVER_URL || "train.skillerwhale.com"
const serverPort = process.env.SERVER_PORT || "443"

const changed_files = []

function postRequestOptions(path, headers) {
  return {
    hostname: hostName,
    port: serverPort,
    protocol: "https:",
    path: `/attendances/${process.env.ATTENDANCE_ID}/${path}`,
    method: "POST",
    headers: headers,
  }
}

function sendPing() {
  const pingOptions = postRequestOptions("pings", {})
  const req = https.request(pingOptions)
  req.on("error", function (error) {
    console.error(error)
    req.destroy()
  })
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
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": data.length
  }
  const options = postRequestOptions("file_snapshots", headers)
  const req = https.request(options, function (res) {
    process.stdout.write(`status: ${res.statusCode}\n`)
    res.on("data", function (d) {
      process.stdout.write(d)
      process.stdout.write("\n")
    })
    // 1xx and 2xx status codes are successful for our purposes
    if(res.statusCode < 300) {
      const this_index = changed_files.indexOf(path)
      if(this_index >= 0) {
        changed_files.splice(this_index, 1)
      }
    }
  })
  req.on("error", function (error) {
    console.error(error)
    req.destroy()
  })
  req.write(data)
  req.end()
}

function uploadChangedFiles() {
  // Iterate over a copy so the indexes don't change as we modify the array
  const changed_files_copy = [...changed_files]
  changed_files_copy.forEach(uploadFile)
}

function hashFile(path) {
  const hasher = crypto.createHash("sha256")
  hasher.update(fs.readFileSync(path))
  return hasher.digest("hex")
}

function pollDirectoryForChanges(dirPath) {
  if (IGNORE_DIRS.includes(path.basename(dirPath))) return
  const files = fs.readdirSync(dirPath)
  files.forEach(function (file) {
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
            console.log(`file changed: ${newPath}`)
            putUpdate(newPath)
          }
        }
        fileHashes.set(newPath, currentHash)
      }
    }
  })
}

function pollerFunction() {
  // Set the timeout first, to ensure an exception doesn't stop the recursion
  setTimeout(pollerFunction, 1000)
  sendPing()
  pollDirectoryForChanges(".")
  firstPass = false
}

function uploaderFunction() {
  // Set the timeout first, to ensure an exception doesn't stop the recursion
  setTimeout(uploaderFunction, 1000)
  uploadChangedFiles()
}

pollerFunction()
uploaderFunction()
