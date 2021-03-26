const core = require('@actions/core');
const github = require('@actions/github');
const artifact = require('@actions/artifact');
const exec = require('@actions/exec');
const io = require('@actions/io');
const simpleGit = require('simple-git');
const fetch = require('node-fetch');
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')


const createToC = (cTypes = []) => {
  let str = ''
  cTypes.forEach(c => {
    str += `* [${c}](#${c.replace(/\s+/g, '-').toLowerCase()})\n`
  })
  return str
}

const jsonToMarkdownTable = (fields = []) => {
  let str = ''
  fields.forEach((field) => {
    const row = `| ${field.join(' | ')} |`
    str += `${row}\n`
  })
  return str
}

const createTables = (cTypes = []) => {
  let str = ''
  cTypes.forEach(({ name, fields }) => {
    str += `\n### ${name}\n${jsonToMarkdownTable(fields)}\n`
  })
  return str
}

async function queryContentful() {
  // Github Contexts
  const { job, runNumber, payload } = github.context
  const { 'head_commit': headCommit, repository, pusher} = payload
  console.log(job, runNumber)
  console.log(headCommit, repository)
  if (headCommit.message.includes('[NO_RERUN]')) {
    return
  }
  
  try {
    const git = simpleGit({ baseDir: path.resolve(__dirname) });
    
    const spaceId = core.getInput('spaceId');
    const envId = core.getInput('envId');
    const accessToken = core.getInput('accessToken');
    const queryParams = core.getInput('queryParams');
    const fileName = core.getInput('fileName');
    const outputDir = core.getInput('outputDir') || '.';
    const branchName = core.getInput('branchName') || repository['master_branch'] || undefined;
    const gitUserName = core.getInput('gitUserName');
    const gitEmail = core.getInput('gitEmail');
    core.setSecret(spaceId)
    core.setSecret(accessToken)
    core.setSecret(gitUserName)
    core.setSecret(gitEmail)
    
    const queryUrl = `https://cdn.contentful.com/spaces/${spaceId}/environments/${envId}/content_types?access_token=${accessToken}&order=name&${queryParams}`
    const outputPath = path.join(__dirname, outputDir, fileName + '.md')
    const outputRelativePath = path.join(outputDir, fileName + '.md')
    console.log(outputPath, outputRelativePath)
    io.mkdirP(outputDir)
    core.info(`Fetching data from Contentful: ${queryUrl}`)
    
    const response = await fetch(queryUrl)
      .then(res => res.json())
      .catch(err => {
        err.contentfulId = response && response.headers && response.headers.get('x-contentful-request-id')
        core.setFailed(`Failed to query Contentful ${err}`)
      })

    const formattedRes = response.items.reduce((prevArr, cType) => {
      const arr = prevArr || []
      const { name, description, fields: f } = cType
      const strippedObj = {
        name,
        description,
        fields: f.map(({ name, id, type, required }) => ([name, id, type === 'Symbol' ? 'Symbol (String)' : type, required]))
      }
      strippedObj.fields.unshift(['---', '---', '---', '---'])
      strippedObj.fields.unshift(['Name', 'ID', 'Type', 'Required'])
      arr.push(strippedObj)
      return arr
    }, [])

    const buildMarkdown = `
# Contentful Content Model
Auto-generated by [ContentfulModelDocs](https://github.com/SavSamoylov/ContentfulModelDocs) Github Action.

Table of Contents
${createToC(formattedRes.map(item => item.name))}
${createTables(formattedRes)}
`
    fs.writeFileSync(outputPath, buildMarkdown)

    const artifactClient = artifact.create()
    const artifactName = 'contentful-content-model';
    const files = [
      outputPath
    ]
    const rootDirectory = '.'
    const options = {
      continueOnError: true
    }

    const uploadResult = await artifactClient.uploadArtifact(artifactName, files, rootDirectory, options)

    // await exec.exec('git --version');
    // await exec.exec('git rev-parse --abbrev-ref HEAD');
    // console.log(await exec.exec('git remote -v'))
    // console.log(process.cwd())
    const gitStatus = await git.status()
    // console.log(gitStatus)
    // console.log(
    //   '> Current git config\n' +
    //   JSON.stringify((await git.listConfig()).all, null, 2)
    // )
    
    // console.log(gitStatus['not_added'].includes(outputPath))
    
    if (gitStatus['not_added'].includes(outputPath) || gitStatus['not_added'].includes(outputRelativePath)) {
      await git
        .addConfig('user.email', gitUserName || pusher.email)
        .addConfig('user.name', gitEmail || pusher.name)
      await git.pull()
      await git.add([outputRelativePath])
      await git.commit(`docs: job ${job} ${runNumber} [NO_RERUN]`)
      try {
        await git.push('origin', branchName)
      } catch (err) {
        console.error(err)
        await git.checkoutLocalBranch(branchName)
        await git.push(['-u', 'origin', branchName])
      }
    }
    // console.log(JSON.stringify((await git.status()), null, 2))
    // await exec.exec('git rev-parse --abbrev-ref HEAD');
    // console.log(
    //   '> Current git config\n' +
    //   JSON.stringify((await git.listConfig()).all, null, 2)
    // )
    // console.log(path.resolve(__dirname))
    // const diff = await git.diffSummary()
    // console.log(diff)
    
    // const command = spawn('ls', ['-la'])

    // command.stdout.on('data', (data) => {
    //   console.log(`${data}`)
    // })

    // command.stderr.on('data', (data) => {
    //   console.error(`${data}`)
    // })

    // command.on('close', (code) => {
    //   console.log(`child process exited with code ${code}`)
    //   process.exit(code)
    // })

    // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // const context = JSON.stringify(github.context, undefined, 2)
    // console.log(`The event context: ${context}`);
    // console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }

}

queryContentful()
