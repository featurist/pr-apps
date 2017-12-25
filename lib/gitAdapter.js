const ShellAdapter = require('./shellAdapter')
const debug = require('debug')('pr-apps:gitAdapter')

module.exports = class GitAdapter {
  constructor ({fs}) {
    this.fs = fs
  }

  async makeShallowPushableClone ({repoUrl, branch}) {
    debug('Cloning %s#%s', repoUrl, branch)

    const tmpDir = this.fs.makeTempDir()
    const sh = new ShellAdapter({cwd: tmpDir})

    await sh(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tmpDir}`)
    this.fs.rmRf(`${tmpDir}/.git`)
    await sh('git init')
    await sh('git config --add user.name pr-apps')
    await sh('git config --add user.email pr-apps@pr-apps.pr')
    await sh('git add .')
    await sh('git commit -m "pr deploy"')

    return {
      fs: this.fs,

      async push (remoteUrl) {
        debug('Pushing HEAD to remote %s master', remoteUrl)

        await sh(`git remote add flynn ${remoteUrl}`)
        await sh('git -c http.sslVerify=false push -f flynn HEAD:refs/heads/master')
      },

      remove () {
        this.fs.rmRf(tmpDir)
      }
    }
  }
}