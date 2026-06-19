$listener = New-Object System.Net.HttpListener
$prefix = 'http://localhost:9091/'
$listener.Prefixes.Add($prefix)
$listener.Start()
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Server running at" $prefix
Write-Host "Root directory:" $root

$map = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.webp' = 'image/webp'
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        $path = [System.Net.WebUtility]::UrlDecode($req.Url.AbsolutePath)
        if ($path -eq '/' -or $path -eq '') {
            $file = Join-Path $root 'game.html'
        } else {
            $file = Join-Path $root ($path.TrimStart('/'))
        }
        $file = [System.IO.Path]::GetFullPath($file)
        if (Test-Path $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
            if ($map.ContainsKey($ext)) { $res.ContentType = $map[$ext] }
            else { $res.ContentType = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found: ' + $path)
            $res.ContentType = 'text/plain; charset=utf-8'
            $res.ContentLength64 = $msg.Length
            $res.OutputStream.Write($msg, 0, $msg.Length)
        }
        $res.Close()
    }
} finally {
    if ($listener) { $listener.Stop(); $listener.Close() }
    Write-Host 'Stopped'
}
