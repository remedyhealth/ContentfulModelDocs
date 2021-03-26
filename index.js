const core = require('@actions/core');
const github = require('@actions/github');
const artifact = require('@actions/artifact');
const exec = require('@actions/exec');
const simpleGit = require('simple-git');
const git = simpleGit();
const fetch = require('node-fetch');
const fs = require('fs')

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
  try {
    const spaceId = core.getInput('space_id');
    const envId = core.getInput('environment_id');
    const accessToken = core.getInput('access_token');
    core.setSecret(spaceId)
    core.setSecret(accessToken)
    
    const response = await fetch(`https://cdn.contentful.com/spaces/${spaceId}/environments/${envId}/content_types?access_token=${accessToken}&order=name`)
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
    fs.writeFileSync('content-model.md', buildMarkdown)

    const artifactClient = artifact.create()
    const artifactName = 'contentful-content-model';
    const files = [
      'content-model.md'
    ]
    const rootDirectory = '.'
    const options = {
      continueOnError: true
    }

    const uploadResult = await artifactClient.uploadArtifact(artifactName, files, rootDirectory, options)

    // await exec.exec('git --version');
    // await exec.exec('git rev-parse --abbrev-ref HEAD');
    const diff = await git.diff()
    core.info(diff)

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    const context = JSON.stringify(github.context, undefined, 2)
    console.log(`The event context: ${context}`);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }

}

queryContentful()
