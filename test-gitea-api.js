const { execSync } = require('child_process');
const fs = require('fs');

try {
  const result = execSync('curl -s -H "Authorization: token 5441d871f875f3083e0044a337b3fee979c1ae64" "http://61.151.241.233:3030/api/v1/orgs/zizhou/teams"', { encoding: 'utf8' });
  fs.writeFileSync('C:/Users/yuyan/Desktop/123/market-data-downloader/api_result.json', result);
} catch (e) {
  fs.writeFileSync('C:/Users/yuyan/Desktop/123/market-data-downloader/api_result.json', 'ERROR: ' + e.message);
}
