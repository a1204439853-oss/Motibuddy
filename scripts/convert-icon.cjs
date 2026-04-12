const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertPngToIco() {
    const inputPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.png');
    const outputPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');
    
    try {
        // 读取 PNG 文件
        const pngBuffer = fs.readFileSync(inputPath);
        
        // 使用 sharp 获取图片信息
        const metadata = await sharp(pngBuffer).metadata();
        console.log(`Original image size: ${metadata.width}x${metadata.height}`);
        
        // 转换为正方形 (取最大边)
        const size = Math.max(metadata.width, metadata.height);
        
        // 生成多种尺寸的 ICO 文件
        const sizes = [16, 32, 48, 64, 128, 256];
        const buffers = [];
        
        for (const iconSize of sizes) {
            const resized = await sharp(pngBuffer)
                .resize(iconSize, iconSize, { 
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toBuffer();
            buffers.push({ size: iconSize, buffer: resized });
        }
        
        // 创建 ICO 文件头
        const icoHeader = Buffer.alloc(6);
        icoHeader.writeUInt16LE(0, 0); // Reserved
        icoHeader.writeUInt16LE(1, 2); // Type: Icon
        icoHeader.writeUInt16LE(buffers.length, 4); // Count
        
        // 计算偏移量
        let offset = 6 + buffers.length * 16;
        const entries = [];
        const imageData = [];
        
        for (const { size, buffer } of buffers) {
            const entry = Buffer.alloc(16);
            entry.writeUInt8(size === 256 ? 0 : size, 0); // Width
            entry.writeUInt8(size === 256 ? 0 : size, 1); // Height
            entry.writeUInt8(0, 2); // Color palette
            entry.writeUInt8(0, 3); // Reserved
            entry.writeUInt16LE(1, 4); // Color planes
            entry.writeUInt16LE(32, 6); // Bits per pixel
            entry.writeUInt32LE(buffer.length, 8); // Size of image data
            entry.writeUInt32LE(offset, 12); // Offset to image data
            entries.push(entry);
            imageData.push(buffer);
            offset += buffer.length;
        }
        
        // 合并所有部分
        const icoBuffer = Buffer.concat([
            icoHeader,
            ...entries,
            ...imageData
        ]);
        
        fs.writeFileSync(outputPath, icoBuffer);
        console.log(`ICO file created successfully at: ${outputPath}`);
    } catch (error) {
        console.error('Error converting PNG to ICO:', error);
        process.exit(1);
    }
}

convertPngToIco();
