const yaml = require('js-yaml')
const {expect} = require('chai')
const PrApps = require('../../../../lib/prApps')
const GitProject = require('../../../../lib/gitProject')
const FlynnApiClientMemory = require('./flynnApiClientMemory')
const CodeHostingServiceApiMemory = require('./codeHostingServiceApiMemory')
const PrAppsClientMemory = require('./prAppsClientMemory')
const GitMemory = require('./gitMemory')
const BaseActor = require('./baseActor')
const DeploymentRepoMemory = require('./deploymentRepoMemory')
const ConfigLoaderMemory = require('./configLoaderMemory')

module.exports = class MemoryAssembly {
  async setup () {}
  async start () {
    this.fakeFlynnApi = {
      apps: new Set(),
      firstApp () {
        return Array.from(this.apps)[0]
      },
      providers: [],
      notPushed: true,
      failNextDeploy () {
        this.nextDeployShouldFail = true
      }
    }
  }
  async stop () {}

  createActor () {
    this.flynnApiClient = new FlynnApiClientMemory({
      fakeFlynnApi: this.fakeFlynnApi
    })

    this.codeHostingServiceApi = new CodeHostingServiceApiMemory()
    const configLoader = new ConfigLoaderMemory()

    this.clusterDomain = 'prs.example.com'

    const prApps = new PrApps({
      codeHostingServiceApi: this.codeHostingServiceApi,
      scmProject: new GitProject({
        token: 'secret',
        remoteUrl: 'https://github.com/asdfsd/bbbb.git',
        git: new GitMemory(this.fakeFlynnApi)
      }),
      flynnApiClientFactory: (clusterDomain) => {
        this.flynnApiClient.clusterDomain = clusterDomain
        return this.flynnApiClient
      },
      appInfo: {
        domain: `pr-apps.${this.clusterDomain}`
      },
      deploymentRepo: new DeploymentRepoMemory(),
      configLoader
    })
    this.prAppsClient = new PrAppsClientMemory({
      prApps,
      fakeFlynnApi: this.fakeFlynnApi
    })

    return new MemoryActor({
      prAppsClient: this.prAppsClient,
      flynnApiClient: this.flynnApiClient,
      fakeFlynnApi: this.fakeFlynnApi,
      configLoader
    })
  }

  enablePrEvents () {
    this.prAppsClient.enable()
  }
}

class MemoryActor extends BaseActor {
  constructor ({prAppsClient, flynnApiClient, fakeFlynnApi, configLoader}) {
    super()
    this.flynnApiClient = flynnApiClient
    this.prAppsClient = prAppsClient
    this.configLoader = configLoader
    this.fakeFlynnApi = fakeFlynnApi
    this.currentBranch = 'Feature1'
    this.prNumber = 23
  }

  async start () {}
  async stop () {}

  async pushBranch () {
    return 'sdfl342342l'
  }

  withExistingPrApp (config) {
    this.flynnApiClient.withExistingApp(`pr-${this.prNumber}`, config)
  }

  withClosedPullRequest () {}

  async openPullRequest ({version, prNumber = this.prNumber, branch = this.currentBranch} = {}) {
    this.currentPrNotifier = await this.prAppsClient.openPullRequest(branch, prNumber, version)
  }

  async reopenPullRequest () {
    this.currentPrNotifier = await this.prAppsClient.reopenPullRequest(this.currentBranch, this.prNumber)
  }

  async pushMoreChanges () {
    this.currentPrNotifier = await this.prAppsClient.pushMoreChanges(this.currentBranch, this.prNumber)
  }

  async closePullRequest () {
    await this.prAppsClient.closePullRequest(this.prNumber)
  }

  async mergePullRequest () {
    await this.prAppsClient.mergePullRequest(this.prNumber)
  }

  async shouldSeeDeployStarted () {
    await this.currentPrNotifier.waitForDeployStarted()
  }

  async shouldSeeDeployFinished () {
    await this.currentPrNotifier.waitForDeployFinished()
  }

  async shouldSeeDeploySuccessful () {
    await this.currentPrNotifier.waitForDeploySuccessful()
  }

  async shouldSeeDeployFailed (options) {
    await this.currentPrNotifier.waitForDeployFailed(options)
  }

  getLastDeploymentUrl () {
    return this.currentPrNotifier.getDeploymentUrl()
  }

  async followLastDeploymentUrl (url) {
    url = url || this.getLastDeploymentUrl()
    const [lastDeployId] = url.match(/[^/]+$/)
    return this.prAppsClient.getDeployment(lastDeployId)
  }

  shouldSeeDeployLogs ({logs}) {
    expect(logs).to.deep.eql(['all done'])
  }

  async shouldNotSeeDeployLogs (url) {
    const [lastDeployId] = url.match(/[^/]+$/)
    const deployment = await this.prAppsClient.getDeployment(lastDeployId)
    expect(deployment).to.be.eq(undefined)
  }

  shouldSeeValidationError ({logs}) {
    expect(logs[0]).to.match(/TypeError: Expected a value/)
  }

  shouldSeeDeployStatus ({status}) {
    expect(status).to.eq('success')
  }

  shouldSeeDeployedAppVersion ({version}, expectedVersion) {
    expect(version).to.eq(expectedVersion)
  }

  shouldSeeLinkToFlynnApp ({flynnAppUrl}) {
    expect(flynnAppUrl).to.eq(
      `https://dashboard.${this.flynnApiClient.clusterDomain}/apps/${this.fakeFlynnApi.firstApp().id}`
    )
  }

  shouldSeeLinkToDeployedApp ({deployedAppUrl}) {
    expect(deployedAppUrl).to.eq(`https://pr-${this.prNumber}.${this.flynnApiClient.clusterDomain}`)
  }

  followDeployedAppLink () {}
  shouldSeeNewApp () {}
  shouldSeeUpdatedApp () {}
  shouldNotSeeApp (appName = `pr-${this.prNumber}`) {
    expect(
      this.flynnApiClient.findAppByName(appName) === undefined ||
      this.fakeFlynnApi.notPushed
    ).to.eq(true)
  }

  addPrAppConfig (config) {
    this.configLoader.setConfig(yaml.safeLoad(config))
  }

  assertEnvironmentSet (env) {
    expect(this.fakeFlynnApi.firstApp().release.env).to.eql(env)
  }

  assertServiceIsUp ({service, domain}) {
    expect(this.fakeFlynnApi.firstApp().routes).to.deep.include({
      type: 'http',
      service,
      domain
    })
  }

  assertResources (resources) {
    expect(this.fakeFlynnApi.firstApp().resources.map(r => {
      const {name} = this.fakeFlynnApi.providers.find(p => p.id === r.provider)
      return name
    }).sort()).to.eql(resources.sort())
  }
}
