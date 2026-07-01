/**
 * Simple, lightweight markdown-to-HTML parser utility for rendering
 * AI streaming responses inside the Tiptap editor.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  let html = "";
  let currentBlock: "ul" | "ol" | "taskList" | "p" | "code" | null = null;

  const inlineParse = (text: string): string => {
    // Basic HTML escaping
    let result = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold: **text** or __text__
    result = result.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/__(.*?)__/g, "<strong>$1</strong>");
    
    // Italic: *text* or _text_
    result = result.replace(/\*(.*?)\*/g, "<em>$1</em>");
    result = result.replace(/_(.*?)_/g, "<em>$1</em>");
    
    // Inline code: `code`
    result = result.replace(/`(.*?)`/g, "<code>$1</code>");

    return result;
  };

  const closeBlock = (): string => {
    if (!currentBlock) return "";
    const type = currentBlock;
    currentBlock = null;
    if (type === "ul") return "</ul>";
    if (type === "ol") return "</ol>";
    if (type === "taskList") return "</ul>";
    if (type === "p") return "</p>";
    if (type === "code") return "</code></pre>";
    return "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Inside code block
    if (currentBlock === "code") {
      if (line.trim().startsWith("```")) {
        html += closeBlock();
      } else {
        html += (html.endsWith("<code>") ? "" : "\n") + inlineParse(line);
      }
      continue;
    }

    // Code block start
    if (line.trim().startsWith("```")) {
      html += closeBlock();
      const langMatch = line.trim().match(/^```(.*)$/);
      const lang = langMatch ? langMatch[1] : "";
      html += `<pre><code class="${lang}">`;
      currentBlock = "code";
      continue;
    }

    const trimmed = line.trim();

    // Details/Toggle start tag
    if (trimmed.toLowerCase().startsWith("<details")) {
      html += closeBlock();
      html += '<details data-type="details">';
      continue;
    }

    // Details/Toggle end tag
    if (trimmed.toLowerCase() === "</details>") {
      html += closeBlock();
      html += '</div></details>';
      continue;
    }

    // Toggle Summary tag
    if (trimmed.toLowerCase().startsWith("<summary>")) {
      html += closeBlock();
      const summaryMatch = line.match(/<summary>(.*)<\/summary>/i);
      const summaryContent = summaryMatch ? summaryMatch[1] : "";
      
      let level: number | null = null;
      let cleanSummary = summaryContent.trim();
      const headingMatch = cleanSummary.match(/^(#{1,4})\s+(.*)$/);
      if (headingMatch) {
        level = headingMatch[1].length;
        cleanSummary = headingMatch[2];
      }

      const parsedSummary = inlineParse(cleanSummary);
      const levelAttr = level ? ` data-level="${level}"` : "";
      html += `<summary data-type="detailsSummary"${levelAttr}>${parsedSummary}</summary><div data-type="detailsContent">`;
      continue;
    }

    // Subpage tag
    if (trimmed.toLowerCase().startsWith("<subpage")) {
      html += closeBlock();
      const idMatch = line.match(/id="([^"]*)"/i);
      const titleMatch = line.match(/title="([^"]*)"/i);
      const iconMatch = line.match(/icon="([^"]*)"/i);

      const id = idMatch ? idMatch[1] : "";
      const title = titleMatch ? titleMatch[1] : "Untitled";
      const icon = iconMatch ? iconMatch[1] : "";

      const idAttr = id ? ` id="${id}"` : "";
      const iconAttr = icon ? ` icon="${icon}"` : "";
      
      html += `<div data-type="subpage"${idAttr} title="${title}"${iconAttr}></div>`;
      continue;
    }

    // Headings: #, ##, ###
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      html += closeBlock();
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineParse(headingMatch[2])}</h${level}>`;
      continue;
    }

    // Task list item: - [ ] or - [x]
    const taskMatch = line.match(/^[-*•]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === "x";
      if (currentBlock !== "taskList") {
        html += closeBlock();
        html += '<ul data-type="taskList">';
        currentBlock = "taskList";
      }
      html += `<li data-type="taskItem" data-checked="${checked}"><p>${inlineParse(taskMatch[2])}</p></li>`;
      continue;
    }

    // Bullet list item: - item or * item
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (currentBlock !== "ul") {
        html += closeBlock();
        html += "<ul>";
        currentBlock = "ul";
      }
      html += `<li><p>${inlineParse(bulletMatch[1])}</p></li>`;
      continue;
    }

    // Ordered list item: 1. item
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (currentBlock !== "ol") {
        html += closeBlock();
        html += "<ol>";
        currentBlock = "ol";
      }
      html += `<li><p>${inlineParse(numMatch[2])}</p></li>`;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      html += closeBlock();
      continue;
    }

    // Regular paragraph
    if (currentBlock !== "p") {
      html += closeBlock();
      html += "<p>";
      currentBlock = "p";
      html += inlineParse(line);
    } else {
      html += " " + inlineParse(line);
    }
  }

  html += closeBlock();
  return html;
}
