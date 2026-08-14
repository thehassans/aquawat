# Deploy Maqder from this Windows PC over SSH (same as GitHub Actions).
# First, on the Plesk server as root, authorize this PC:
#   echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIo0OAcpdi6P+FRAPxq5mLlHAyV3jZX3Uj4rTVy/aGJP kjh@pc" >> /root/.ssh/authorized_keys
#
# Then from the repo:
#   powershell -File ops/plesk-deploy.ps1

$ErrorActionPreference = "Stop"
$key = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
if (-not (Test-Path $key)) {
  throw "Missing $key"
}

ssh -i $key `
  -o IdentitiesOnly=yes `
  -o BatchMode=yes `
  -o ConnectTimeout=15 `
  -o StrictHostKeyChecking=accept-new `
  root@87.237.228.159 `
  "chmod +x /var/www/vhosts/maqder.com/httpdocs/deploy.sh && /var/www/vhosts/maqder.com/httpdocs/deploy.sh"
