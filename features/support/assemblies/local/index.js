const PrApps = require('../../../../lib/prApps')
const GitProject = require('../../../../lib/gitProject')
const FsAdapter = require('../../../../lib/fsAdapter')
const GitAdapter = require('../../../../lib/gitAdapter')
const FlynnApiClient = require('../../../../lib/flynnApiClient')
const ShellAdapter = require('../../../../lib/shellAdapter')
const ConfigLoader = require('../../../../lib/configLoader')
const DeploymentRepo = require('../../../../lib/deploymentRepo')
const WorkQueue = require('../../../../lib/workQueue')
const createPrAppsApp = require('../../../..')
const startTestApp = require('../../startTestApp')
const GitRepo = require('../github/gitRepo')
const FakeFlynnApi = require('../github/fakeFlynnApi')
const CodeHostingServiceApiMemory = require('../memory/codeHostingServiceApiMemory')
const getRandomPort = require('../github/getRandomPort')
const PrNotifier = require('../memory/prNotifier')
const ApiActorBase = require('./apiActorBase')
const PrAppsWebClient = require('./prAppsWebClient')
const db = require('../../../../db/models')
const resetDb = require('../../resetDb')

module.exports = class LocalAssembly {
  setup () {}

  async start () {
    const [port] = await Promise.all([
      getRandomPort(),
      resetDb(db)
    ])
    this.clusterDomain = `prs.localtest.me:${port}`

    this.fakeFlynnApi = new FakeFlynnApi({
      authKey: 'flynnApiAuthKey',
      clusterDomain: this.clusterDomain
    })

    this.remoteRepoPath = new FsAdapter().makeTempDir()
    const remoteUrl = `file:///${this.remoteRepoPath}`
    const remoteRepoSh = new ShellAdapter({cwd: this.remoteRepoPath})
    this.deploymentStatusEvents = []

    const createPrApps = (contextDebug) => {
      this.codeHostingServiceApi = new CodeHostingServiceApiMemory({
        deploymentStatusEvents: this.deploymentStatusEvents,
        contextDebug
      })

      const git = new GitAdapter({
        fs: new FsAdapter({contextDebug}),
        contextDebug
      })

      const scmProject = new GitProject({
        remoteUrl,
        git
      })

      const deploymentRepo = new DeploymentRepo(db)

      return new PrApps({
        contextDebug,
        codeHostingServiceApi: this.codeHostingServiceApi,
        scmProject,
        workQueue: new WorkQueue({timeout: 200, contextDebug}),
        flynnApiClientFactory: (clusterDomain) => {
          return new FlynnApiClient({
            clusterDomain,
            authKey: 'flynnApiAuthKey',
            contextDebug
          })
        },
        appInfo: {
          domain: `pr-apps.${this.clusterDomain}`
        },
        deploymentRepo,
        configLoader: new ConfigLoader({contextDebug})
      })
    }

    this.webhookSecret = 'webhook secret'
    const prAppsApp = createPrAppsApp({
      webhookSecret: this.webhookSecret,
      createPrApps
    })

    this.userLocalRepo = new GitRepo({remoteUrl})

    this.appServer = startTestApp({
      prAppsApp,
      fakeFlynnApi: this.fakeFlynnApi,
      port
    })

    this.prAppsClient = new PrAppsWebClient(`https://pr-apps.prs.localtest.me:${port}`, this.webhookSecret)

    await Promise.all([
      remoteRepoSh('git init --bare'),
      this.userLocalRepo.create()
    ])
  }

  async stop () {
    await Promise.all([
      this.fakeFlynnApi.stop(),
      this.prAppsServer
        ? new Promise(resolve => this.prAppsServer.close(resolve))
        : Promise.resolve()
    ])
    new FsAdapter().rmRf(this.remoteRepoPath)
    await this.userLocalRepo.destroy()
  }

  enablePrEvents () {
    this.prAppsClient.enable()
  }

  createActor () {
    return new LocalActor({
      userLocalRepo: this.userLocalRepo,
      prAppsClient: this.prAppsClient,
      deploymentStatusEvents: this.deploymentStatusEvents,
      fakeFlynnApi: this.fakeFlynnApi
    })
  }
}

class LocalActor extends ApiActorBase {
  constructor ({
    deploymentStatusEvents,
    userLocalRepo,
    prAppsClient,
    fakeFlynnApi
  }) {
    super({userLocalRepo, fakeFlynnApi, currentBranch: 'Feature1'})
    this.prAppsClient = prAppsClient
    this.deploymentStatusEvents = deploymentStatusEvents
    this.prNumber = 23
  }

  async openPullRequest ({prNumber = this.prNumber, branch = this.currentBranch} = {}) {
    const body = {
      action: 'opened',
      number: prNumber,
      pull_request: {
        head: {
          ref: branch
        }
      }
    }
    await this.prAppsClient.post('/webhook', body)

    return new PrNotifier({
      deploymentStatusEvents: this.deploymentStatusEvents,
      branch,
      prNumber,
      fakeFlynnApi: this.fakeFlynnApi
    })
  }

  async reopenPullRequest () {
    const body = {
      action: 'reopened',
      number: this.prNumber,
      pull_request: {
        head: {
          ref: this.currentBranch,
          sha: 1
        }
      }
    }
    await this.prAppsClient.post('/webhook', body)

    return new PrNotifier({
      deploymentStatusEvents: this.deploymentStatusEvents,
      branch: this.currentBranch,
      prNumber: this.prNumber,
      fakeFlynnApi: this.fakeFlynnApi
    })
  }

  async mergePullRequest () {
    const body = {
      action: 'closed',
      number: this.prNumber,
      pull_request: {
        head: {
          ref: this.currentBranch
        }
      }
    }
    await this.prAppsClient.post('/webhook', body)
  }

  async closePullRequest () {
    const body = {
      action: 'closed',
      number: this.prNumber,
      pull_request: {
        head: {
          ref: this.currentBranch
        }
      }
    }
    await this.prAppsClient.post('/webhook', body)
  }

  async pushMoreChanges () {
    await this.userLocalRepo.pushBranch(this.currentBranch, '<p>This is Pr Apps</p>')
    const body = {
      action: 'synchronize',
      number: this.prNumber,
      pull_request: {
        head: {
          ref: this.currentBranch
        }
      }
    }
    await this.prAppsClient.post('/webhook', body)

    return new PrNotifier({
      deploymentStatusEvents: this.deploymentStatusEvents,
      branch: this.currentBranch,
      prNumber: this.prNumber,
      fakeFlynnApi: this.fakeFlynnApi
    })
  }
}
