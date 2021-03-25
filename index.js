const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('node-fetch');

async function queryContentful() {
  try {
    const spaceId = core.getInput('space_id');
    const envId = core.getInput('environment_id');
    const accessToken = core.getInput('access_token');
    core.setSecret(spaceId)
    core.setSecret(accessToken)
    
    const response = await fetch(`https://cdn.contentful.com/spaces/${spaceId}/environments/${envId}/content_types?access_token=${accessToken}`)
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
        fields: f.map(({name, type, required}) => ([name, type === 'Symbol' ? 'String' : type, required]))
      }
      return arr.push(strippedObj)
    }, [])
    
    console.log(JSON.stringify(formattedRes, 0, 2))
    const time = (new Date()).toTimeString();
    core.setOutput("time", time);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
  
}

queryContentful()
