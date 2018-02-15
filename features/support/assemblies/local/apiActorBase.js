const retry = require('trytryagain')
const {expect} = require('chai')
const HeadlessBrowser = require('../github/headlessBrowser')
const retryTimeout = require('../../retryTimeout')
const BaseActor = require('../memory/baseActor')
const clone = require('../../../../lib/clone')

module.exports = class ApiActorBase extends BaseActor {
  constructor ({
    userLocalRepo,
    currentBranch,
    fakeFlynnApi
  }) {
    super()
    this.userLocalRepo = userLocalRepo
    this.currentBranch = currentBranch
    this.fakeFlynnApi = fakeFlynnApi
  }

  start () {}
  stop () {}

  async withExistingPrApp (config) {
    await this.pushBranch()
    await this.openPullRequest()
    await this.createPrApp(config)
    await this.followDeployedAppLink()
    await this.shouldSeeNewApp()
  }

  async withClosedPullRequest () {
    await this.pushBranch()
    await this.openPullRequest()
    await this.closePullRequest()
  }

  async pushBranch () {
    await this.userLocalRepo.pushBranch(this.currentBranch, '<h1>Hello World!</h1>')
  }

  async createPrApp (config = {}) {
    const {gitUrl} = await this.fakeFlynnApi.createApp(`pr-${this.prNotifier.prNumber}`)
    if (config.resources) {
      this.fakeFlynnApi.addResources(config.resources)
    }
    const env = Object.assign({VERSION: 1}, config.env)
    this.fakeFlynnApi.addEnv(env)
    await this.userLocalRepo.pushCurrentBranchToFlynn(gitUrl)
  }

  async shouldSeeDeployStarted () {
    await this.prNotifier.waitForDeployStarted()
  }

  async shouldSeeDeployFinished () {
    await this.prNotifier.waitForDeployFinished()
  }

  async shouldSeeDeploySuccessful () {
    await this.prNotifier.waitForDeploySuccessful()
  }

  async shouldSeeDeployFailed () {
    await this.prNotifier.waitForDeployFailed()
  }

  async followDeployedAppLink () {
    const browser = new HeadlessBrowser()
    const deployedAppUrl = `https://pr-${this.prNotifier.prNumber}.${this.fakeFlynnApi.clusterDomain}`
    this.appIndexPageContent = await browser.visit(deployedAppUrl)
  }

  async shouldBeAbleToPushLargeRepos () {
    const initDeploy = this.fakeFlynnApi.deploys[0]
    expect(initDeploy.release.processes.slugbuilder.resources.temp_disk.limit).to.eq(1073741824)
    expect(initDeploy.release.processes.slugbuilder.resources.memory.limit).to.eq(2147483648)
  }

  async shouldSeeNewApp () {
    expect(this.appIndexPageContent).to.eq('<h1>Hello World!</h1>')
  }

  async shouldSeeUpdatedApp () {
    expect(this.appIndexPageContent).to.eq('<h1>Hello World!</h1><p>This is Pr Apps</p>')
  }

  async shouldNotSeeApp () {
    await retry(async () => {
      await this.followDeployedAppLink()
      expect(this.appIndexPageContent).to.eq('Pr App Not Found')
    }, {timeout: retryTimeout, interval: 500})
  }

  async addPrAppConfig (config) {
    await this.userLocalRepo.addFile('pr-app.yaml', config)
  }

  async assertEnvironmentSet (config) {
    await retry(() => {
      const lastDeploy = clone(this.fakeFlynnApi.lastDeploy)
      delete lastDeploy.release.env.VERSION
      delete lastDeploy.release.processes

      expect(lastDeploy).to.eql({
        appName: `pr-${this.prNumber}`,
        release: {
          id: this.fakeFlynnApi.release.id,
          appName: `pr-${this.prNumber}`,
          env: config
        }
      })
    }, {timeout: retryTimeout})
  }

  async assertServiceIsUp ({service, domain}) {
    await retry(() => {
      expect(this.fakeFlynnApi.extraRoutes).to.eql({
        type: 'http',
        service,
        domain
      })
      expect(this.fakeFlynnApi.scale).to.eql({
        web: 1,
        [service.replace(`pr-${this.prNumber}-`, '')]: 1
      })
    }, {timeout: retryTimeout})
  }

  async assertResources (resources) {
    await retry(() => {
      expect(this.fakeFlynnApi.resources.map(r => r.providerName).sort()).to.eql(resources.sort())
      expect(this.fakeFlynnApi.resources.map(r => r.apps)).to.eql([
        [`pr-${this.prNumber}`],
        [`pr-${this.prNumber}`]
      ])
    }, {timeout: retryTimeout})
  }

  shouldNotSeeFlynnApp () {
    expect(Object.keys(this.fakeFlynnApi.apps).length).to.eq(0)
  }
}
