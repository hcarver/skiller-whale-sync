const readline = require("readline")
const spawn = require("cross-spawn")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function swsync (other_cmd) {
  cl = console.log
  cl("  _____ _    _ _ _            __          ___           _      ")
  cl(" / ____| |  (_) | |           \\ \\        / / |         | |     ")
  cl("| (___ | | ___| | | ___ _ __   \\ \\  /\\  / /| |__   __ _| | ___ ")
  cl(" \\___ \\| |/ / | | |/ _ \\ '__|   \\ \\/  \\/ / | '_ \\ / _` | |/ _ \\")
  cl(" ____) |   <| | | |  __/ |       \\  /\\  /  | | | | (_| | |  __/")
  cl("|_____/|_|\\_\\_|_|_|\\___|_|        \\/  \\/   |_| |_|\\__,_|_|\\___| ")
  cl("")
  console.log(
    "Please copy and paste your ID from the course page here and press enter.\n"
  )
  rl.question("Trainee ID: ", attendanceId => {
    console.log("")
    console.log("Great! We're going to start a development server running now")
    console.log("and we'll be watching your directory here for changes so that")
    console.log("the trainer can see your progress. Hit Ctrl+C twice to stop.")
    console.log("")
    const server = spawn.spawn(
      "npx",
      ["concurrently", '"' + other_cmd + '"', '"content-sync"'],
      { env: { ...process.env, ATTENDANCE_ID: attendanceId.trim() } }
    )

    server.on("error", data => {
      console.log(`error: ${data}`)
    })
    server.stdout.on("data", data => {
      process.stdout.write(data)
    })
    server.stderr.on("data", data => {
      process.stderr.write(data)
    })
  })
}

module.exports = swsync
