const core = require('@actions/core');
const github = require('@actions/github');
const fetch = require('node-fetch');

try {
  const spaceId = core.getInput('space_id');
  const envId = core.getInput('environment_id');
  const accessToken = core.getInput('access_token');
  core.setSecret(spaceId)
  core.setSecret(envId)
  core.setSecret(accessToken)
  
  
  const response = await fetch(`https://cdn.contentful.com/spaces/${spaceId}/environments/${envId}/content_types?access_token=${access_token}`)
    .then(res => res.json())
    .catch(err => {
      err.contentfulId = response && response.headers && response.headers.get('x-contentful-request-id')
      logger.error('Error during rest request', err)
      core.setFailed(`Failed to query Contentful ${err}`)
      throw err
    })
  
  
  console.log(JSON.stringify(response, 0, 2))
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
