const GithubUrl = require('../../../../lib/githubUrl')
const Github = require('@octokit/rest')

module.exports = class GithubApi {
  constructor ({repo, token}) {
    ({owner: this.owner, repo: this.repo} = new GithubUrl({repoUrl: repo, token}))
    this.ghApi = new Github()
    this.ghApi.authenticate({
      type: 'token',
      token
    })
    this.authOpts = {
      owner: this.owner,
      repo: this.repo
    }
  }

  async createHook (opts) {
    await this.ghApi.repos.createHook(
      Object.assign({}, this.authOpts, opts)
    )
  }

  async getBranches () {
    const {data} = await this.ghApi.repos.getBranches(Object.assign({}, this.authOpts))
    return data
  }

  async deleteReference (opts) {
    await this.ghApi.gitdata.deleteReference(Object.assign({}, opts, this.authOpts))
  }

  async getAllPrs () {
    const {data} = await this.ghApi.pullRequests.getAll(Object.assign({}, this.authOpts))
    return data
  }

  async getHooks () {
    const {data} = await this.ghApi.repos.getHooks(Object.assign({}, this.authOpts))
    return data
  }

  async deleteHook (opts) {
    await this.ghApi.repos.deleteHook(Object.assign({}, opts, this.authOpts))
  }

  async createPullRequest (opts) {
    const {data} = await this.ghApi.pullRequests.create(Object.assign({}, opts, this.authOpts))
    return data
  }

  async mergePullRequest (opts) {
    await this.ghApi.pullRequests.merge(Object.assign({}, opts, this.authOpts))
  }

  async closePullRequest (opts) {
    await this.ghApi.pullRequests.update(Object.assign({state: 'closed'}, opts, this.authOpts))
  }

  async reopenPullRequest (opts) {
    const {data} = await this.ghApi.pullRequests.update(Object.assign({state: 'open'}, opts, this.authOpts))
    return data
  }

  async getDeploymentStatus (opts) {
    const {data} = await this.ghApi.repos.getDeploymentStatus(
      Object.assign({}, opts, this.authOpts, {
        headers: {
          accept: 'application/vnd.github.ant-man-preview+json'
        }
      }
    ))
    return data
  }
}
