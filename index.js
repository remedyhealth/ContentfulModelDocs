const core = require('@actions/core');
const github = require('@actions/github');

try {
  const secretId = core.getInput('who-to-greet');
  const envId = core.getInput('who-to-greet');
  const accessToken = core.getInput('who-to-greet');
  console.log(core.setSecret(secretId))
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
