const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('node-fetch');

const createToC = (cTypes = []) => {
  let str = ''
  cTypes.forEach(c => {
    str+=`* [${c}](#${c.replace(/\s+/g, '-').toLowerCase()})\n`
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
        fields: f.map(({name, id, type, required}) => ([name, id, type === 'Symbol' ? 'Symbol (String)' : type, required]))
      }
      strippedObj.fields.unshift(['Name', 'ID', 'Type', 'Required'])
      arr.push(strippedObj)
      return arr
    }, [])
      
      // .sort(cTypes => cType.name)
    
    console.log(JSON.stringify(formattedRes, 0, 2))
    
    const buildMarkdown = `
Table of Contents
${createToC(formattedRes.map(item => item.name))}
`
    
    console.log(buildMarkdown)
    
    
    const time = (new Date()).toTimeString();
    core.setOutput("time", time);
    // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
  
}

queryContentful()
