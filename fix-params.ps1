# Fix Next.js 15 params Promise requirement in all dynamic route handlers

$files = Get-ChildItem -Path "src\app\api" -Filter "route.ts" -Recurse | Where-Object { $_.DirectoryName -match '\[.*\]' }

Write-Host "Found $($files.Count) dynamic route files to check" -ForegroundColor Cyan

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $updated = $false
    
    # Pattern 1: { params }: { params: { ... } }
    if ($content -match '\{ params \}: \{ params: \{[^}]+\} \}') {
        Write-Host "Fixing: $($file.Name)" -ForegroundColor Yellow
        
        # Replace all variations
        $content = $content -replace '\{ params \}: \{ params: \{ id: string \} \}', 'context: { params: Promise<{ id: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ orderId: string \} \}', 'context: { params: Promise<{ orderId: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ staffId: string \} \}', 'context: { params: Promise<{ staffId: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ tableId: string \} \}', 'context: { params: Promise<{ tableId: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ sessionId: string \} \}', 'context: { params: Promise<{ sessionId: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ slug: string \} \}', 'context: { params: Promise<{ slug: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ qrToken: string \} \}', 'context: { params: Promise<{ qrToken: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ requestId: string \} \}', 'context: { params: Promise<{ requestId: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ businessId: string; tableNumber: string \} \}', 'context: { params: Promise<{ businessId: string; tableNumber: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ businessSlug: string \} \}', 'context: { params: Promise<{ businessSlug: string }> }'
        $content = $content -replace '\{ params \}: \{ params: \{ id: string; action: string \} \}', 'context: { params: Promise<{ id: string; action: string }> }'
        
        # Add params await at the start of try block
        $content = $content -replace '(\) \{\s+try \{\s+)', "`$1`n    const params = await context.params;`n    "
        
        $updated = $true
    }
    
    if ($updated) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "  ✓ Fixed: $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "`nDone! Run 'npm run build' to verify." -ForegroundColor Cyan
