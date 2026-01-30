import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function estimateReadingTime(words: number, wpm: number = 200): string {
  const minutes = Math.ceil(words / wpm);
  return `${minutes} min left`;
}

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- Text Conversion (OpenCC) ---
let converter: any = null;

/**
 * 修改重點：使用正則表達式保護 Markdown 圖片標籤
 * 防止 Base64 編碼被繁簡轉換器破壞
 */
export async function convertToTraditional(text: string): Promise<string> {
  if (!converter) {
    try {
        // @ts-ignore
        const OpenCC = await import('opencc-js');
        converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    } catch (e) {
        console.warn("OpenCC load failed, skipping conversion", e);
        return text;
    }
  }

  // 1. 使用正則表達式匹配 Markdown 圖片語法: ![alt](src)
  // 此處捕獲組會將匹配到的圖片標籤保留在 split 後的陣列中
  const parts = text.split(/(!\[.*?\]\(.*?\))/g);
  
  // 2. 遍歷陣列，只轉換非圖片的部分
  const convertedParts = parts.map(part => {
    if (part.startsWith('![')) {
      // 這是圖片標籤，直接返回，不准轉換
      return part;
    }
    // 這是普通文字，執行繁簡轉換
    return converter(part);
  });

  return convertedParts.join('');
}

// --- File Parsing Logic ---

interface ParsedBook {
    content: string;
    coverUrl?: string;
    title?: string;
    author?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function parseEpub(arrayBuffer: ArrayBuffer): Promise<ParsedBook> {
  // @ts-ignore
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("Invalid EPUB: Missing container.xml");
  
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(container, "text/xml");
  const rootPath = containerDoc.getElementsByTagName("rootfile")[0]?.getAttribute("full-path");
  if (!rootPath) throw new Error("Invalid EPUB: No rootfile in container");

  const opfContent = await zip.file(rootPath)?.async("string");
  if (!opfContent) throw new Error("Invalid EPUB: Missing OPF file");
  const opfDoc = parser.parseFromString(opfContent, "text/xml");

  const metadata = opfDoc.getElementsByTagName("metadata")[0];
  const manifest = opfDoc.getElementsByTagName("manifest")[0];
  const spine = opfDoc.getElementsByTagName("spine")[0];
  
  const getTagContent = (tagName: string, namespacePrefix: string = "dc:") => {
      const tags = [
          ...Array.from(metadata.getElementsByTagName(namespacePrefix + tagName)),
          ...Array.from(metadata.getElementsByTagName(tagName))
      ];
      return tags[0]?.textContent || undefined;
  };

  const title = getTagContent("title") || "Untitled";
  const author = getTagContent("creator") || "Unknown Author";

  const idToHref: Record<string, string> = {};
  Array.from(manifest.getElementsByTagName("item")).forEach(item => {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if(id && href) idToHref[id] = href;
  });

  const getZipFile = (href: string) => {
      const parts = href.split('/');
      const fileName = parts.pop();
      if (!fileName) return null;
      
      const opfFolder = rootPath.substring(0, rootPath.lastIndexOf("/") + 1);
      const possiblePaths = [
          opfFolder + href,
          href,
          parts.join('/') + '/' + fileName
      ];

      for (const p of possiblePaths) {
          if (zip.file(p)) return zip.file(p);
      }

      const safeName = escapeRegExp(fileName);
      const matches = zip.file(new RegExp(`/${safeName}$`)); 
      if (matches.length > 0) return matches[0];
      
      return zip.file(fileName);
  };

  let coverId = null;
  const metaTags = Array.from(metadata.getElementsByTagName("meta"));
  const coverMeta = metaTags.find(m => m.getAttribute("name") === "cover");
  if (coverMeta) coverId = coverMeta.getAttribute("content");

  if (!coverId) {
      const coverItem = Array.from(manifest.getElementsByTagName("item"))
          .find(item => item.getAttribute("properties")?.includes("cover-image"));
      if (coverItem) coverId = coverItem.getAttribute("id");
  }

  let coverUrl: string | undefined = undefined;
  if (coverId && idToHref[coverId]) {
      const file = getZipFile(idToHref[coverId]);
      if (file) {
          const blob = await file.async("blob");
          coverUrl = await blobToBase64(blob);
      }
  }

  let fullText = `# ${title}\n\n*${author}*\n\n---\n\n`;
  const itemrefs = Array.from(spine.getElementsByTagName("itemref"));

  for (const itemref of itemrefs) {
      const id = itemref.getAttribute("idref");
      const href = id ? idToHref[id] : null;
      if (!href) continue;
      
      const file = getZipFile(href);
      if (file) {
          let content = await file.async("string");
          const doc = parser.parseFromString(content, "text/html");
          
          const images = Array.from(doc.getElementsByTagName('img'));
          for (const img of images) {
              const src = img.getAttribute('src');
              if (src) {
                  const imgFile = getZipFile(src);
                  if (imgFile) {
                      const blob = await imgFile.async("blob");
                      const base64 = await blobToBase64(blob);
                      img.setAttribute('src', base64);
                      img.style.maxWidth = "100%"; 
                  }
              }
          }

          const body = doc.body;
          if (body) {
              ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
                  body.querySelectorAll(tag).forEach(h => {
                      const level = tag.replace('h', '');
                      h.replaceWith(`\n\n${'#'.repeat(parseInt(level))} ${h.textContent}\n\n`);
                  });
              });
              
              body.querySelectorAll('img').forEach(img => {
                  const src = img.getAttribute('src');
                  const alt = img.getAttribute('alt') || 'image';
                  if(src && src.startsWith('data:')) {
                      img.replaceWith(`\n\n![${alt}](${src})\n\n`);
                  }
              });

              body.querySelectorAll('p, div, blockquote').forEach(p => { 
                  p.innerHTML = `${p.innerHTML}\n\n`; 
              });
              
              body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
              body.querySelectorAll('script, style, link').forEach(s => s.remove());

              fullText += (body.textContent || "").replace(/\n\s+\n/g, '\n\n') + "\n";
          }
      }
  }
  return { content: fullText, coverUrl, title, author };
}

async function parsePdf(arrayBuffer: ArrayBuffer): Promise<ParsedBook> {
    try {
        // @ts-ignore
        const pdfjsModule = await import('pdfjs-dist');
        const pdfjsLib = pdfjsModule.default || pdfjsModule;

        const PDFJS_VERSION = '3.11.174';
        const CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN_BASE}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            cMapUrl: `${CDN_BASE}/cmaps/`,
            cMapPacked: true,
        });
        
        const pdf = await loadingTask.promise;
        let fullText = "";
        let coverUrl: string | undefined = undefined;
        
        let title = "PDF Document";
        let author = "Unknown Author";

        try {
            const metadata = await pdf.getMetadata();
            if (metadata?.info) {
                // @ts-ignore
                if (metadata.info.Title) title = metadata.info.Title;
                // @ts-ignore
                if (metadata.info.Author) author = metadata.info.Author;
            }
        } catch (e) {
            console.warn("Failed to extract PDF metadata", e);
        }

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            if (i === 1) {
                try {
                    const coverViewport = page.getViewport({ scale: 1.0 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = coverViewport.width;
                    canvas.height = coverViewport.height;
                    const renderContext: any = { canvasContext: ctx!, viewport: coverViewport };
                    await page.render(renderContext).promise;
                    coverUrl = canvas.toDataURL('image/jpeg', 0.8);
                } catch (e) {
                    console.warn("Cover render failed", e);
                }
            }

            const textContent = await page.getTextContent();
            const items = textContent.items as any[];
            const pageText = items.map(item => item.str).join(' ');
            
            if (pageText.trim().length < 100) {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const renderContext: any = { canvasContext: ctx!, viewport };
                    await page.render(renderContext).promise;
                    const imgData = canvas.toDataURL('image/jpeg', 0.8);
                    fullText += `\n\n![Page ${i}](${imgData})\n\n`;
                } catch (e) {
                    fullText += `\n\n*[Image Render Error Page ${i}]*\n\n`;
                }
            } else {
                const formattedText = items.map(item => item.str).join('\n\n');
                fullText += `\n\n### Page ${i}\n\n${formattedText}\n\n---\n`;
            }
        }

        if (!fullText.trim()) fullText = "# Empty Document\n\nNo text extracted.";
        return { content: fullText, title, author, coverUrl };
    } catch (e: any) {
        console.error("PDF Parse Error", e);
        throw new Error("PDF Failed: " + (e.message || "Unknown error"));
    }
}

export async function parseEbook(file: File): Promise<ParsedBook> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
        if (ext === 'epub') {
            const buffer = await file.arrayBuffer();
            return await parseEpub(buffer);
        } else if (ext === 'pdf') {
            const buffer = await file.arrayBuffer();
            return await parsePdf(buffer);
        } else {
            const text = await file.text();
            return { content: text, title: file.name.replace(/\.[^/.]+$/, "") };
        }
    } catch (e: any) {
        return { 
            content: `# Parsing Error\n\nCould not open ${file.name}.\nDetails: ${e.message}`,
            title: "Error"
        };
    }
}