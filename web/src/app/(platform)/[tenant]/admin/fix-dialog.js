const fs = require('fs');
const path = require('path');

const adminDir = 'd:\\worloard\\sms(scoole management  software )\\web\\src\\app\\(platform)\\[tenant]\\admin';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Regex to find:
      // <DialogTrigger asChild>
      //   <Button className="X">
      //     inner content
      //   </Button>
      // </DialogTrigger>
      
      const regex = /<DialogTrigger asChild>\s*<Button className="([^"]+)">([\s\S]*?)<\/Button>\s*<\/DialogTrigger>/g;
      
      const newContent = content.replace(regex, (match, className, inner) => {
        return `<DialogTrigger render={<Button className="${className}" />}>${inner}</DialogTrigger>`;
      });
      
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(adminDir);
console.log("Done");
