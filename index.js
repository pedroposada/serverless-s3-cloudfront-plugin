'use strict';

const spawnSync = require('child_process').spawnSync;

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      syncToS3: {
        usage: 'Deploys the `app` directory to your bucket',
        lifecycleEvents: [
          'sync',
        ],
      },
      domainInfo: {
        usage: 'Fetches and prints out the deployed CloudFront domain names',
        lifecycleEvents: [
          'domainInfo',
        ],
      },
      invalidateCache: {
        usage: 'Creates new invalidation in CloudFront',
        lifecycleEvents: [
          'invalidate',
        ],
      },
    };

    this.hooks = {
      'syncToS3:sync': this.syncDirectory.bind(this),
      'domainInfo:domainInfo': this.domainInfo.bind(this),
      'invalidateCache:invalidate': this.invalidateCache.bind(this),
    };
  }

  // syncs the `app` directory to the provided bucket
  syncDirectory() {
    const s3Bucket = this.serverless.variables.service.custom.s3Bucket;
    const distFolder = this.serverless.variables.service.custom.distFolder || 'build';
    const args = [
      's3',
      'sync',
      `${distFolder}/`,
      `s3://${s3Bucket}/`,
    ];
    const result = spawnSync('aws', args);
    const stdout = result.stdout.toString();
    const sterr = result.stderr.toString();
    if (stdout) {
      this.serverless.cli.log(stdout);
    }
    if (sterr) {
      this.serverless.cli.log(sterr);
    }
    if (!sterr) {
      this.serverless.cli.log('Successfully synced to the S3 bucket');
    }
  }

  // fetches the domain name from the CloudFront outputs and prints it out
  domainInfo() {
    const provider = this.serverless.getProvider('aws');
    const stackName = provider.naming.getStackName(this.options.stage);
    return provider
    .request(
      'CloudFormation',
      'describeStacks',
      { StackName: stackName },
      this.options.stage,
      this.options.region // eslint-disable-line comma-dangle
    )
    .then((result) => {
      const outputs = result.Stacks[0].Outputs;
      const output = outputs.find(entry => entry.OutputKey === 'WebAppCloudFrontDistributionOutput');
      if (output.OutputValue) {
        this.serverless.cli.log(`Web App Domain: https://${output.OutputValue}`);
      } else {
        this.serverless.cli.log('Web App Domain: Not Found');
      }
    });
  }
  
  // Create new invalidation in Cloudfront
  invalidateCache() {
    this.serverless.cli.log('invalidate CloudFront cache')
    const s3Bucket = this.serverless.variables.service.custom.s3Bucket;
    let args = [
      'cloudfront',
      'list-distributions',
    ];
    let result = spawnSync('aws', args);
    let stdout = result.stdout.toString();
    let sterr = result.stderr.toString();
    if (stdout) {
      const { DistributionList: { Items = [] } = {} } = JSON.parse(stdout) || {};
      const [ { Id:DistId } ] = Items.filter(({ 
        Origins: { Items: [ { DomainName } = {} ] = [] } = {}
      }) =>
        DomainName === `${s3Bucket}.s3.amazonaws.com`
      )
      this.serverless.cli.log(DistId);
      args = [
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        `${DistId}`,
        '--paths',
        '/*',
      ];
      result = spawnSync('aws', args);
      stdout = result.stdout.toString();
      sterr = result.stderr.toString();
      if (stdout) {
        this.serverless.cli.log(stdout);
        return;
      }
      if (sterr) {
        this.serverless.cli.log(sterr);
        return;
      }
    }
    if (sterr) {
      this.serverless.cli.log(sterr);
    }
  }
}

module.exports = ServerlessPlugin;
