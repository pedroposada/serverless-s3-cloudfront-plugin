'use strict'

const spawnSync = require('child_process').spawnSync

class ServerlessPlugin {
  constructor (serverless, options) {
    this.serverless = serverless
    this.options = options
    this.commands = {
      wipeS3: {
        usage: 'Empties S3 bucket',
        lifecycleEvents: [
          'wipe'
        ]
      },
      syncToS3: {
        usage: 'Deploys the `app` directory to your bucket',
        lifecycleEvents: [
          'sync'
        ]
      },
      domainInfo: {
        usage: 'Fetches and prints out the deployed CloudFront domain names',
        lifecycleEvents: [
          'domainInfo'
        ]
      },
      invalidateCache: {
        usage: 'Creates new invalidation in CloudFront',
        lifecycleEvents: [
          'invalidate'
        ]
      }
    }

    this.hooks = {
      'wipeS3:wipe': this.wipeDirectory.bind(this),
      'syncToS3:sync': this.syncDirectory.bind(this),
      'domainInfo:domainInfo': this.domainInfo.bind(this),
      'invalidateCache:invalidate': this.invalidateCache.bind(this)
    }
  }

  // delete all contents of the S3 bucket
  wipeDirectory () {
    const s3Bucket = this.serverless.variables.service.custom.s3Bucket
    const args = [
      's3',
      'rm',
      `s3://${s3Bucket}/`,
      '--recursive'
    ]
    const result = spawnSync('aws', args)
    const stdout = result.stdout.toString()
    const sterr = result.stderr.toString()
    if (stdout) {
      this.serverless.cli.log(stdout)
    }
    if (sterr) {
      this.serverless.cli.log(sterr)
    }
    if (!sterr) {
      this.serverless.cli.log('Successfully wiped S3 bucket clean')
    }
  }
  
  // syncs the `app` directory to the provided bucket
  syncDirectory () {
    const s3Bucket = this.serverless.variables.service.custom.s3Bucket
    const distFolder = this.serverless.variables.service.custom.distFolder || 'build'
    const args = [
      's3',
      'sync',
      `${distFolder}`,
      `s3://${s3Bucket}/`
    ]
    const result = spawnSync('aws', args)
    const stdout = result.stdout.toString()
    const sterr = result.stderr.toString()
    if (stdout) {
      this.serverless.cli.log(stdout)
    }
    if (sterr) {
      this.serverless.cli.log(sterr)
    }
    if (!sterr) {
      this.serverless.cli.log('Successfully synced to the S3 bucket')
    }
  }

  // fetches the domain name from the CloudFront outputs and prints it out
  domainInfo () {
    const provider = this.serverless.getProvider('aws')
    const stackName = provider.naming.getStackName(this.options.stage)
    return provider
      .request(
        'CloudFormation',
        'describeStacks',
        { StackName: stackName },
        this.options.stage,
        this.options.region
      )
      .then((result) => {
        if (!result.Stacks || !result.Stacks[0].Outputs) {
          this.serverless.cli.log('Web App Domain: Not Found')
          return
        }
        const outputs = result.Stacks[0].Outputs
        const output = outputs.find(entry => entry.OutputKey === 'WebsiteDistribution')
        this.serverless.cli.log(`Results for Outputs.WebsiteDistribution: ${JSON.stringify(output)}`)
        if (output && output.OutputValue) {
          this.serverless.cli.log(`Web App Domain: ${output.OutputValue}`)
        } else {
          this.serverless.cli.log('Web App Domain: Not Found')
        }
      })
  }

  // Create new invalidation in Cloudfront
  invalidateCache () {
    this.serverless.cli.log('invalidate CloudFront cache')
    const s3Bucket = this.serverless.variables.service.custom.s3Bucket
    let args = [
      'cloudfront',
      'list-distributions'
    ]
    let result = spawnSync('aws', args)
    let stdout = result.stdout.toString()
    let sterr = result.stderr.toString()
    if (stdout) {
      const { DistributionList: { Items = [] } = {} } = JSON.parse(stdout) || {}
      const [ { Id: DistId } = {} ] = Items.filter(({
        Origins: { Items: [ { DomainName } = {} ] = [] } = {}
      }) =>
        DomainName === `${s3Bucket}.s3.amazonaws.com`
      )

      if (!DistId) {
        this.serverless.cli.log(`DistId not found!`)
        return
      }

      this.serverless.cli.log(`DistId: ${DistId}`)
      args = [
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        `${DistId}`,
        '--paths',
        '/*'
      ]
      result = spawnSync('aws', args)
      stdout = result.stdout.toString()
      sterr = result.stderr.toString()
      if (stdout) {
        this.serverless.cli.log(stdout)
        return
      }
      if (sterr) {
        this.serverless.cli.log(sterr)
        return
      }
    }
    if (sterr) {
      this.serverless.cli.log(sterr)
    }
  }
}

module.exports = ServerlessPlugin
