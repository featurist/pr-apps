const retry = require('trytryagain')
const {expect} = require('chai')
const retryTimeout = require('../../retryTimeout')

module.exports = class PrNotifier {
  constructor ({
    prEventsListener,
    branch
  }) {
    this.prEventsListener = prEventsListener
    this.branch = branch
  }

  async waitForDeployStarted () {
    await retry(() => {
      const {branch, status} = this.prEventsListener.deploymentStatusEvents[0]
      expect(branch).to.eq(this.branch)
      expect(status).to.eq('pending')
    }, {timeout: retryTimeout})
  }

  async waitForDeployFinished () {
    await retry(() => {
      expect(this.prEventsListener.deploymentStatusEvents.length).to.eq(2)
    }, {timeout: retryTimeout})
  }

  async waitForDeploySuccessful () {
    await retry(() => {
      const {branch, status} = this.prEventsListener.deploymentStatusEvents[this.prEventsListener.deploymentStatusEvents.length - 1]
      expect(branch).to.eq(this.branch)
      expect(status).to.eq('success')
    }, {timeout: retryTimeout})
  }

  async waitForDeployFailed ({instantly} = {}) {
    await retry(() => {
      const {branch, status} = this.prEventsListener.deploymentStatusEvents[instantly ? 0 : 1]
      expect(branch).to.eq(this.branch)
      expect(status).to.eq('failure')
    }, {timeout: retryTimeout})
  }

  getDeploymentUrl () {
    const {deploymentUrl} = this.prEventsListener.deploymentStatusEvents[this.prEventsListener.deploymentStatusEvents.length - 1]
    return deploymentUrl
  }

  async assertDeploysAreSequential () {
    await retry(() => {
      expect(this.prEventsListener.deploymentStatusEvents.length).to.be.above(3)
      this.prEventsListener.deploymentStatusEvents.reduce((prevEvent, event, i) => {
        if (i > 0) {
          if (prevEvent.status === 'pending') {
            expect(event.deploymentUrl).to.eq(prevEvent.deploymentUrl)
            expect(event.status).to.eq('success')
          } else {
            expect(event.deploymentUrl).to.not.eq(prevEvent.deploymentUrl)
            expect(event.status).to.eq('pending')
          }
        }
        return event
      })
    }, {timeout: retryTimeout})
  }
}
