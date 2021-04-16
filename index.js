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
  const { 'head_commit': headCommit, repository, pusher } = payload
  
  // console.log(github.context)

  // if (headCommit.message.includes('[NO_RERUN]')) {
  //   return
  // }
  
  try {
    const git = simpleGit({ baseDir: path.resolve(__dirname) });
    
    const spaceId = core.getInput('spaceId');
    const envId = core.getInput('envId');
    const accessToken = core.getInput('accessToken');
    const queryParams = core.getInput('queryParams');
    const fileName = core.getInput('fileName');
    const outputDir = core.getInput('outputDir') || '.';
    const branchName = core.getInput('branchName') || 'gh-pages';
    const gitUserName = core.getInput('gitUserName');
    const gitEmail = core.getInput('gitEmail');
    core.setSecret(spaceId)
    core.setSecret(accessToken)
    core.setSecret(gitUserName)
    core.setSecret(gitEmail)
    
    const queryUrl = `https://cdn.contentful.com/spaces/${spaceId}/environments/${envId}/content_types?access_token=${accessToken}&order=name&${queryParams}`
    const outputPath = path.join(__dirname, outputDir, fileName + '.md')
    const outputRelativePath = path.join(outputDir, fileName + '.md')
    
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

    const gitStatus = await git.status()
    console.log('Git status:\n', gitStatus)
    if (gitStatus['not_added'].includes(outputPath) || gitStatus['not_added'].includes(outputRelativePath)) {
      await git
        .addConfig('user.email', gitEmail || pusher.email)
        .addConfig('user.name', gitUserName || pusher.name)
      
      console.log(await git.branchLocal())
      // await git.push(['origin', '--delete', branchName])
      await git.listRemote(branchName)
      // await git.removeRemote(branchName)
      // await git.pull()
      // await git.add([outputRelativePath])
      // await git.commit(`docs: job ${job} ${runNumber} [NO_RERUN]`)
      // try {
      //   await git.push('origin', branchName)
      // } catch (err) {
      //   console.error(err)
        // await git.fetch('origin', branchName, ['--force'])
        
        // try {
        //   await git.checkout(branchName)
        //   await git.push('origin', branchName)
        // } catch (err) {
        //   console.log(err)
        //   await git.checkoutLocalBranch(branchName)
        //   await git.push(['-u', 'origin', branchName])
        // }
      // }
    }
  } catch (error) {
    core.setFailed(error.message);
  }

}

queryContentful()
