const png2icons = require('png2icons');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildIcons() {
  try {
    console.log('📦 开始生成图标...');
    
    // 读取PNG文件并放大到512x512
    const inputPath = path.join(__dirname, '../public/icon-source.png');
    console.log('📖 读取源文件:', inputPath);
    
    // 使用sharp放大到512x512，确保高质量
    const resizedBuffer = await sharp(inputPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    console.log('✅ 图像已调整为512x512');
    
    // 生成ICO文件（Windows）- 包含多种尺寸
    console.log('🪟 生成Windows图标（包含16,32,48,64,128,256尺寸）...');
    const icoOutput = await png2icons.createICO(resizedBuffer, png2icons.BILINEAR, 0, false, true);
    if (icoOutput) {
      fs.writeFileSync(path.join(__dirname, '../public/icon.ico'), icoOutput);
      console.log('✅ icon.ico 生成成功！大小:', icoOutput.length, '字节');
    }
    
    // 生成ICNS文件（macOS）
    console.log('🍎 生成macOS图标...');
    const icnsOutput = await png2icons.createICNS(resizedBuffer, png2icons.BILINEAR, 0);
    if (icnsOutput) {
      fs.writeFileSync(path.join(__dirname, '../public/icon.icns'), icnsOutput);
      console.log('✅ icon.icns 生成成功！大小:', icnsOutput.length, '字节');
    }
    
    // 保存高质量PNG（Linux）
    console.log('🐧 保存高质量PNG图标...');
    fs.writeFileSync(path.join(__dirname, '../public/icon.png'), resizedBuffer);
    console.log('✅ icon.png 保存成功！');
    
    console.log('🎉 所有图标生成完成！');
  } catch (error) {
    console.error('❌ 生成图标失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

buildIcons();

