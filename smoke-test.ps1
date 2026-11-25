$ErrorActionPreference = 'Stop'
$base = 'http://localhost/visitor-management/api/index.php'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:csrf = ''
$failures = 0

function Call-Api {
  param(
    [Parameter(Mandatory = $true)][string]$Action,
    [string]$Method = 'GET',
    [hashtable]$Body = @{}
  )
  $headers = @{}
  if ($script:csrf) { $headers['X-CSRF-Token'] = $script:csrf }
  $p = @{
    Uri = "$base`?action=$Action"; Method = $Method; WebSession = $session
    Headers = $headers; UseBasicParsing = $true; TimeoutSec = 20
  }
  if ($Body.Count -gt 0) {
    $p.Body = ($Body | ConvertTo-Json -Compress)
    $p.ContentType = 'application/json'
  }
  try {
    $r = Invoke-WebRequest @p
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg = $_.ErrorDetails.Message
    throw "[$Action] HTTP $code $msg"
  }
  $h = $r.Headers['X-CSRF-Token']
  if ($h) { $script:csrf = $h }
  return $r
}

function Check([string]$name, [scriptblock]$test) {
  try {
    & $test | Out-Null
    Write-Host "  PASS  $name" -ForegroundColor Green
  } catch {
    $script:failures++
    Write-Host "  FAIL  $name -> $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host 'VisitorPass smoke test' -ForegroundColor Cyan

Check 'CSRF endpoint' { Call-Api 'csrf' }
Check 'Login as admin' { Call-Api 'login' POST @{ username = 'admin'; password = 'admin123' } }
Check 'Session (me)' { $r = Call-Api 'me'; if (-not ($r.Content | ConvertFrom-Json).user) { throw 'no user' } }
Check 'Dashboard stats' { $r = Call-Api 'stats'; if (-not ($r.Content | ConvertFrom-Json).days) { throw 'no days' } }
Check 'Visitor list' { $r = Call-Api 'list'; if ($null -eq ($r.Content | ConvertFrom-Json).visitors) { throw 'no visitors' } }
Check 'Host directory' { $r = Call-Api 'hosts.list'; if ($null -eq ($r.Content | ConvertFrom-Json).hosts) { throw 'no hosts' } }
Check 'Appointments' { $r = Call-Api 'appointments.list'; if ($null -eq ($r.Content | ConvertFrom-Json).appointments) { throw 'no appointments' } }
Check 'Reports' { $r = Call-Api 'report'; if ($null -eq ($r.Content | ConvertFrom-Json).summary) { throw 'no summary' } }
Check 'Audit log' { $r = Call-Api 'audit.list'; if ($null -eq ($r.Content | ConvertFrom-Json).entries) { throw 'no entries' } }
Check 'Users list' { $r = Call-Api 'users.list'; if ($null -eq ($r.Content | ConvertFrom-Json).users) { throw 'no users' } }
Check 'Settings' { $r = Call-Api 'settings.get'; if ($null -eq ($r.Content | ConvertFrom-Json).settings) { throw 'no settings' } }
Check 'CSV export' { $r = Call-Api 'export'; if (-not $r.Content.StartsWith('Badge')) { throw 'bad CSV' } }

$visitorId = $null
Check 'Create visitor' {
  $r = Call-Api 'create' POST @{
    full_name = 'Smoke Test Visitor'; company = 'QA'; purpose = 'Meeting'; host_name = 'Reception'; phone = '09990000000'
  }
  $v = ($r.Content | ConvertFrom-Json).visitor
  if (-not $v.badge_no -or -not $v.qr_token) { throw 'no badge/QR token' }
  $script:visitorId = $v.id
}
Check 'Lookup by badge' {
  $r = Invoke-WebRequest -Uri "$base`?action=lookup&q=Smoke%20Test%20Visitor" -WebSession $session -UseBasicParsing
  if (-not ($r.Content | ConvertFrom-Json).visitor) { throw 'not found' }
}
Check 'Check out visitor' {
  $r = Call-Api 'checkout' POST @{ id = $visitorId }
  if (-not ($r.Content | ConvertFrom-Json).ok) { throw 'checkout failed' }
}
Check 'Check out again returns 409' {
  try { Call-Api 'checkout' POST @{ id = $visitorId }; throw 'expected 409' }
  catch { if ($_.Exception.Message -notmatch '409') { throw } }
}
if ($visitorId) {
  Check 'Cleanup test visitor' { Call-Api 'delete' POST @{ id = $visitorId } | Out-Null }
}

Write-Host ''
if ($failures -eq 0) {
  Write-Host "All checks passed." -ForegroundColor Green
} else {
  Write-Host "$failures check(s) failed." -ForegroundColor Red
  exit 1
}
