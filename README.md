# serverless-s3-cloudfront-plugin
Plugin for serverless framework to manage an S3 bucket and a CloudFront distribution in AWS

## Installation
In the terminal ("-D" is for dev dependency)
```bash
yarn add -D https://github.com/pedroposada/serverless-s3-cloudfront-plugin.git
```
And in your serverless.yml add the following values to the custom block
```yml
# serverless.yml
plugins:
  - serverless-s3-cloudfront-plugin

custom:
  s3Bucket: my-bucket   # required, the name of your bucket. It will be created if it doesnt exist already
  distFolder: build     # required, name of folder where your local static files are
  distroId: myDistro    # required, arbitrary name to identify your cloudfront distribution
```


## Available commands
// pirnt out the cloudfront domain for your bucket
```bash
serverless domainInfo
```

// updalod files from your "distFolder" to your bucket. Will not delete any files, just update
```bash
serverless syncToS3
```

// create new cach invalidation to refresh content in cloudfront
```bash
serverless invalidateCache
```


## Sample serverless.yml
https://github.com/pedroposada/serverless-s3-cloudfront-plugin/blob/master/serverless.yml
