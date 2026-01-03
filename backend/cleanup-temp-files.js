const fs = require('fs');
const path = require('path');

function cleanupTempFiles() {
    const tempDir = path.join(__dirname, 'uploads/temp');
    
    if (!fs.existsSync(tempDir)) {
        console.log('ℹ️ No temp directory found');
        return;
    }
    
    const files = fs.readdirSync(tempDir);
    console.log(`🗑️ Found ${files.length} temp files to clean up`);
    
    let deletedCount = 0;
    files.forEach(file => {
        const filePath = path.join(tempDir, file);
        try {
            // Delete files older than 1 hour
            const stats = fs.statSync(filePath);
            const now = new Date();
            const fileAge = now - stats.mtime;
            const oneHour = 60 * 60 * 1000;
            
            if (fileAge > oneHour) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`✅ Deleted: ${file}`);
            }
        } catch (error) {
            console.error(`❌ Failed to delete ${file}:`, error.message);
        }
    });
    
    console.log(`✅ Cleanup complete: Deleted ${deletedCount} files`);
}

// Run cleanup
cleanupTempFiles();