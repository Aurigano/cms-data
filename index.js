const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");
const { rimraf } = require("rimraf");

const app = express();
const upload = multer({ dest: "uploads/" });
const port = 4000;
const REPO_URL = "https://github.com/Aurigano/cms-data.git";
const BRANCH_NAME = "master";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

app.get("/", cors(), async (req, res) => {
  res.send("This works!");
});

app.post("/update-md", async (req, res) => {
  const { filePath, markdownContent } = req.body;

  if (!filePath || !markdownContent) {
    res.status(400).send("Missing required params");
  }

  const repoDir = path.join(__dirname, "repo");

  try {
    // Clones the git repo
    await simpleGit().clone(REPO_URL, repoDir, [
      "--branch",
      BRANCH_NAME,
      "--single-branch",
    ]);

    // replace the .md file
    const fullPath = path.join(repoDir, filePath);
    fs.writeFileSync(fullPath, markdownContent, "utf-8");

    // commit and push changes
    const git = simpleGit(repoDir);
    await git.add(filePath);
    await git.commit("Update markdown fil by API");
    await git.push("origin", BRANCH_NAME);

    res.status(201).send("Markdown file updated and pushed succesfully");
  } catch (err) {
    console.error("Error: ", err);
    res.status(500).send("Something went wrong");
  } finally {
    // delete repo
    // fs.rmSync(repoDir, { recursive: true, force: true });

    // setTimeout(() => {
    //   fs.rmSync(repoDir, { recursive: true, force: true });
    // }, 1000); // 1 second delay

    // Use rimraf to remove the directory
    rimraf(repoDir, (err) => {
      if (err) {
        console.error("Error removing directory:", err);
      } else {
        console.log("Directory removed successfully");
      }
    });
  }
});

app.post("/upload-file", upload.single("file"), async (req, res) => {
  const git = simpleGit();
  try {
    // Ensure that req has a file
    const { file } = req;
    const { repoPath } = req.body;

    if (!file) {
      return res.status(400).send("No file uploaded");
    }

    if (!repoPath) {
      return res.status(400).send("No repo path provided");
    }

    // Ensure the uploaded file exists in the uploads folder
    const fileExists = fs.existsSync(file.path);
    if (!fileExists) {
      console.error("File not found in uploads folder:", file.path); // Log the error for debugging
      return res.status(400).send("Uploaded file not found.1");
    }

    // cloning repo
    const repoDir = path.join(__dirname, "repo");

    if (!fs.existsSync(repoDir)) {
      await git.clone(REPO_URL, repoDir, [
        "--branch",
        BRANCH_NAME,
        "--single-branch",
      ]);
    }

    // move into the repo dir
    process.chdir(repoDir);

    // makes the folder if it doesn't exists
    const destDir = path.join(repoDir, repoPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Construct the destination file path
    const sanitizedFileName = file.originalname.replace(/\s+/g, "_"); // Sanitize file name
    const destPath = path.join(destDir, sanitizedFileName);

    const fullFilePath = path.join(__dirname, file.path);

    // Check if the uploaded file exists in the 'uploads' folder
    if (!fs.existsSync(fullFilePath)) {
      return res
        .status(400)
        .send(
          `Uploaded file not found.2  ${destPath} ${file.path} ${fullFilePath}`
        );
    }

    //checking the if a similar exists in that path
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath); // deletes the file
    }

    //move it to dest path
    fs.renameSync(fullFilePath, destPath);

    await git.init();
    await git.add(".");
    await git.commit("Adding uploaded file");
    // await git.addRemote("origin", "https://github.com/Aurigano/cms-data.git");
    await git.remote([
      "set-url",
      "origin",
      "https://github.com/Aurigano/cms-data.git",
    ]);
    await git.branch(["--set-upstream-to=origin/master", "master"]);
    await git.fetch();
    await git.pull();
    await git.push();

    res.status(200).send("File uploaded and committed successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("An Error occured while uploading the file");
  }
});

app.listen(port, () => {
  console.log("Listening to port 4000");
});
