import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useWindowState } from '@/lib/windowContext';
import { Bold, Italic, Underline, List, Image as ImageIcon, Link, Code, Send } from 'lucide-react';
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement, Text, BaseEditor, Node } from 'slate';
import { Slate, Editable, withReact, useSlate, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { css } from '@emotion/css';
import axios from 'axios';
import { Window } from './Windows';

// Define custom element types
type ParagraphElement = { type: 'paragraph'; children: CustomText[] };
type HeadingOneElement = { type: 'heading-one'; children: CustomText[] };
type HeadingTwoElement = { type: 'heading-two'; children: CustomText[] };
type BlockQuoteElement = { type: 'block-quote'; children: CustomText[] };
type BulletedListElement = { type: 'bulleted-list'; children: CustomText[] };
type NumberedListElement = { type: 'numbered-list'; children: CustomText[] };
type ListItemElement = { type: 'list-item'; children: CustomText[] };
type ImageElement = { type: 'image'; url: string; children: CustomText[] };
type LinkElement = { type: 'link'; url: string; children: CustomText[] };

type CustomElement = 
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | BlockQuoteElement
  | BulletedListElement
  | NumberedListElement
  | ListItemElement
  | ImageElement
  | LinkElement;

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
};

type CustomEditor = BaseEditor & ReactEditor;

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// Hotkeys for formatting
const HOTKEYS: Record<string, string> = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+`': 'code',
};

// Initial value for the editor
const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: '' }],
  } as ParagraphElement,
];

// Define the Range type
const Range = {
  isCollapsed(range: any): boolean {
    return (
      range.anchor.path.every((n: number, i: number) => n === range.focus.path[i]) &&
      range.anchor.offset === range.focus.offset
    );
  },
};

export function Contact() {
  const { handleActivity } = useWindowState();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const defaultPosition = useMemo(() => ({ x: 100, y: 100 }), []);

  // Create a Slate editor object that won't change across renders
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()));
    
    // Override isVoid to handle images properly
    const { isVoid } = e;
    e.isVoid = element => {
      return element.type === 'image' ? true : isVoid(element);
    };

    // Override normalizeNode to ensure valid structure
    const { normalizeNode } = e;
    e.normalizeNode = ([node, path]) => {
      if (!Editor.isEditor(node) && !Text.isText(node) && SlateElement.isElement(node)) {
        // Ensure each block has at least one text child
        if (node.children.length === 0) {
          Transforms.insertNodes(
            e,
            { text: '' },
            { at: [...path, 0] }
          );
          return;
        }
      }

      if (Editor.isEditor(node)) {
        // Ensure the editor has at least one block
        if (node.children.length === 0) {
          Transforms.insertNodes(
            e,
            { type: 'paragraph', children: [{ text: '' }] },
            { at: [0] }
          );
          return;
        }

        // Ensure each top-level node is a block
        const children = Array.from(Node.children(node, path));
        for (const [child, childPath] of children) {
          if (Text.isText(child)) {
            Transforms.wrapNodes(
              e,
              { type: 'paragraph', children: [] },
              { at: childPath }
            );
            return;
          }
        }
      }

      // Fall back to the original normalization logic
      normalizeNode([node, path]);
    };
    
    // Override insertData for better image handling
    const { insertData } = e;
    e.insertData = (data: DataTransfer) => {
      const { files } = data;
      
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            const url = reader.result;
            if (typeof url === 'string') {
              insertImage(e, url);
            }
          });
          reader.readAsDataURL(file);
          return;
        }
      }
      
      insertData(data);
    };
    
    return e;
  }, []);

  // Define a serializing function that takes a Slate value and returns Discord markdown
  const serializeToDiscord = (nodes: Descendant[]): string => {
    return nodes.map(node => {
      if (!node) return '';

      if (Editor.isEditor(node)) {
        return serializeToDiscord(node.children);
      }

      if (SlateElement.isElement(node)) {
        const element = node as CustomElement;
        
        if (element.type === 'image' && 'url' in element) {
          // Skip images in the markdown - we'll handle them separately
          return '';
        }
        
        if (element.type === 'link' && 'url' in element) {
          const children = element.children?.map(n => serializeToDiscord([n])).join('') || '';
          return `[${children}](${element.url})`;
        }

        const children = element.children?.map(n => serializeToDiscord([n])).join('') || '';
        
        switch (element.type) {
          case 'bulleted-list':
            return children.split('\n').map(item => `• ${item}`).join('\n');
          case 'numbered-list':
            return children.split('\n').map((item, i) => `${i + 1}. ${item}`).join('\n');
          case 'list-item':
            return children + '\n';
          case 'block-quote':
            return children.split('\n').map(line => `> ${line}`).join('\n');
          default:
            return children + '\n';
        }
      }

      const textNode = node as CustomText;
      if (!textNode.text) return '';

      let string = textNode.text;
      
      if (textNode.code) string = `\`${string}\``;
      if (textNode.bold) string = `**${string}**`;
      if (textNode.italic) string = `*${string}*`;
      if (textNode.underline) string = `__${string}__`;
      
      return string;
    }).join('');
  };

  // Extract all images from the editor content
  const extractImages = (nodes: Descendant[]): string[] => {
    const images: string[] = [];
    
    const traverse = (node: Descendant) => {
      if (SlateElement.isElement(node) && node.type === 'image' && 'url' in node) {
        // Only collect data URLs that need to be uploaded
        if (node.url.startsWith('data:')) {
          images.push(node.url);
        }
      }
      if (SlateElement.isElement(node) && node.children) {
        node.children.forEach(traverse);
      }
    };
    
    nodes.forEach(traverse);
    return images;
  };

  const uploadImage = async (dataUrl: string): Promise<string> => {
    try {
      // Convert data URL to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('file', blob, 'image.png');

      // Upload directly to Discord webhook
      const response = await axios.post('/api/contact/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      return response.data.url;
    } catch (err) {
      console.error('Failed to upload image:', err);
      throw new Error('Failed to upload image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get a snapshot of the current content
      const content = JSON.parse(JSON.stringify(editor.children));
      
      // Check if content is empty
      if (!content || content.length === 0 || (content.length === 1 && SlateElement.isElement(content[0]) && content[0].children.length === 1 && content[0].children[0].text === '')) {
        setError('Please enter a message');
        return;
      }

      setSending(true);
      setError('');
      
      // Extract and upload images first
      const images = extractImages(content);
      let uploadedUrls: string[] = [];
      
      if (images.length > 0) {
        try {
          uploadedUrls = await Promise.all(images.map(uploadImage));
        } catch (uploadError) {
          setError('Failed to upload one or more images. Please try again.');
          setSending(false);
          return;
        }
      }

      // Create a copy of the content to modify for Discord
      const contentCopy = JSON.parse(JSON.stringify(content));
      let imageIndex = 0;

      // Replace data URLs with uploaded URLs in the content
      const traverse = (node: any) => {
        if (node.type === 'image' && node.url.startsWith('data:')) {
          node.url = uploadedUrls[imageIndex++];
        }
        if (node.children) {
          node.children.forEach(traverse);
        }
      };
      contentCopy.forEach(traverse);
      
      // Convert content to Discord format
      const discordContent = serializeToDiscord(contentCopy).trim();
      
      await axios.post('/api/contact', {
        message: discordContent
      });
      
      setSent(true);
      
      // Reset editor content safely
      const point = { path: [0, 0], offset: 0 };
      editor.selection = { anchor: point, focus: point };
      editor.history = { undos: [], redos: [] };
      editor.children = initialValue;
      
      // Reset the sent status after 3 seconds
      setTimeout(() => {
        setSent(false);
      }, 3000);
    } catch (err) {
      setError('Failed to send message. Please try again later.');
      console.error('Error sending contact message:', err);
    } finally {
      setSending(false);
    }
  };

  // Define a leaf rendering function
  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />;
  }, []);

  // Define a element rendering function
  const renderElement = useCallback((props: any) => {
    return <Element {...props} editor={editor} />;
  }, [editor]);

  // Handle keyboard shortcuts for formatting
  const handleKeyDown = (event: React.KeyboardEvent) => {
    for (const hotkey in HOTKEYS) {
      if (isHotkey(hotkey, event)) {
        event.preventDefault();
        const mark = HOTKEYS[hotkey];
        toggleMark(editor, mark);
      }
    }
  };

  // Handle pasted data
  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    
    // Handle pasted files (e.g., dragged images)
    if (event.clipboardData.files.length > 0) {
      const file = event.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          insertImage(editor, dataUrl);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    
    // Handle pasted text
    const text = event.clipboardData.getData('text/plain');
    if (text) {
      editor.insertText(text);
    }
  };

  // Handle selection change to show/hide the toolbar
  const handleSelectionChange = useCallback(() => {
    const { selection } = editor;
    
    if (selection && !ReactEditor.isFocused(editor)) {
      ReactEditor.focus(editor);
    }
    
    handleActivity();
  }, [editor, handleActivity]);

  // Handle image insertion
  const insertImage = (editor: CustomEditor, url: string) => {
    if (!url) return;
    
    const image: ImageElement = { 
      type: 'image', 
      url, 
      children: [{ text: '' }] 
    };
    
    const node = { type: 'paragraph', children: [{ text: '' }] } as ParagraphElement;
    
    if (editor.selection) {
      const [parent] = Editor.parent(editor, editor.selection);
      if (SlateElement.isElement(parent) && parent.type !== 'image') {
        Transforms.insertNodes(editor, image);
        Transforms.insertNodes(editor, node);
        return;
      }
    }
    
    Transforms.insertNodes(editor, image);
    Transforms.insertNodes(editor, node);
  };

  // Handle image upload
  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      
      const file = target.files[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        const dataUrl = reader.result as string;
        insertImage(editor, dataUrl);
      };
      
      reader.readAsDataURL(file);
    };
    
    input.click();
  };

  // Handle link insertion
  const insertLink = () => {
    const url = prompt('Enter the URL:');
    if (!url) return;
    
    if (editor.selection) {
      const isCollapsed = Range.isCollapsed(editor.selection);
      const link: LinkElement = {
        type: 'link',
        url,
        children: isCollapsed ? [{ text: url }] : [],
      };
      
      if (isCollapsed) {
        Transforms.insertNodes(editor, link);
      } else {
        Transforms.wrapNodes(editor, link, { split: true });
        Transforms.collapse(editor, { edge: 'end' });
      }
    }
  };

  return (
    <Window title="contact" windowId="contact" defaultPosition={defaultPosition}>
      <div className="w-[450px]">
        {sent ? (
          <div className="success-message bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            Message sent successfully! Thank you for your feedback.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="mb-4 relative">
              <label className="block text-sm font-medium mb-1">Message</label>
              <div 
                ref={editorRef}
                className="border border-cs-border overflow-auto relative bg-cs-window text-cs-text"
              >
                <Slate
                  editor={editor}
                  initialValue={initialValue}
                  onChange={value => {
                    const isAstChange = editor.operations.some(
                      op => 'set_selection' !== op.type
                    );
                    if (isAstChange) {
                      // Create a new reference for the children array
                      editor.children = value.map(node => ({...node}));
                    }
                    handleSelectionChange();
                  }}
                >
                  <div
                    className={css`
                      position: sticky;
                      top: 0;
                      left: 0;
                      right: 0;
                      z-index: 2;
                      background-color: var(--cs-window);
                      border-bottom: 1px solid var(--cs-border);
                      padding: 8px;
                      display: flex;
                      gap: 8px;
                      align-items: center;
                    `}
                  >
                    <ToolbarButton format="bold" icon={<Bold size={16} />} />
                    <ToolbarButton format="italic" icon={<Italic size={16} />} />
                    <ToolbarButton format="underline" icon={<Underline size={16} />} />
                    <ToolbarButton format="code" icon={<Code size={16} />} />
                    <span className="border-r border-cs-border mx-1 h-5"></span>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleImageUpload();
                      }}
                      className="text-cs-text hover:text-blue-300"
                    >
                      <ImageIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        insertLink();
                      }}
                      className="text-cs-text hover:text-blue-300"
                    >
                      <Link size={16} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleBlock(editor, 'bulleted-list');
                      }}
                      className="text-cs-text hover:text-blue-300"
                    >
                      <List size={16} />
                    </button>
                  </div>
                  <div className="p-3 h-[250px] overflow-auto">
                    <Editable
                      renderElement={renderElement}
                      renderLeaf={renderLeaf}
                      placeholder="Write your message here..."
                      spellCheck
                      autoFocus
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="min-h-full outline-none"
                    />
                  </div>
                </Slate>
              </div>
            </div>
            
            {error && (
              <div className="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="cs-button flex items-center"
              >
                {sending ? 'Sending...' : (
                  <>
                    <Send size={16} className="mr-2" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Window>
  );
}

// Define a React component to render leaves with formatting
const Leaf = ({ attributes, children, leaf }: any) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }

  if (leaf.underline) {
    children = <u>{children}</u>;
  }

  if (leaf.code) {
    children = <code className="bg-opacity-20 bg-cs-border px-1 rounded">{children}</code>;
  }

  return <span {...attributes}>{children}</span>;
};

// Define a React component to render elements
const Element = (props: any) => {
  const { attributes, children, element, editor } = props;

  switch (element.type) {
    case 'block-quote':
      return <blockquote {...attributes} className="border-l-4 border-cs-border pl-4 italic">{children}</blockquote>;
    case 'bulleted-list':
      return <ul {...attributes} className="list-disc ml-6">{children}</ul>;
    case 'heading-one':
      return <h1 {...attributes} className="text-2xl font-bold">{children}</h1>;
    case 'heading-two':
      return <h2 {...attributes} className="text-xl font-bold">{children}</h2>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    case 'numbered-list':
      return <ol {...attributes} className="list-decimal ml-6">{children}</ol>;
    case 'image':
      return (
        <div {...attributes} contentEditable={false} className="my-2">
          <div contentEditable={false} data-slate-void>
            <img 
              src={element.url} 
              alt="Uploaded image" 
              className="max-w-full h-auto border border-cs-border block" 
            />
          </div>
          <span
            contentEditable
            style={{
              position: 'absolute',
              top: 0,
              height: '0',
              opacity: 0,
              pointerEvents: 'none'
            }}
          >
            {children}
          </span>
        </div>
      );
    case 'link':
      return (
        <a {...attributes} href={element.url} className="text-blue-500 underline">
          {children}
        </a>
      );
    default:
      return <p {...attributes}>{children}</p>;
  }
};

// Helper to check if a mark is currently active
const isMarkActive = (editor: Editor, format: string): boolean => {
  const marks = Editor.marks(editor);
  return marks ? marks[format as keyof typeof marks] === true : false;
};

// Helper to toggle a mark
const toggleMark = (editor: Editor, format: string): void => {
  const isActive = isMarkActive(editor, format);
  
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

// Helper to check if a block is active
const isBlockActive = (editor: Editor, format: string): boolean => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        (n as CustomElement).type === format,
    })
  );

  return !!match;
};

// Helper to toggle a block
const toggleBlock = (editor: Editor, format: string): void => {
  const isActive = isBlockActive(editor, format);
  const isList = format === 'numbered-list' || format === 'bulleted-list';

  Transforms.unwrapNodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      ['numbered-list', 'bulleted-list'].includes((n as CustomElement).type),
    split: true,
  });

  const newProperties: Partial<CustomElement> = {
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  } as Partial<CustomElement>;
  
  Transforms.setNodes(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format, children: [] } as CustomElement;
    Transforms.wrapNodes(editor, block);
  }
};

// Define a React component to render toolbar buttons
const ToolbarButton = ({ format, icon }: { format: string, icon: React.ReactNode }) => {
  const editor = useSlate();
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMark(editor, format);
      }}
      className={css`
        cursor: pointer;
        color: var(--cs-text);
        opacity: ${isMarkActive(editor, format) ? 1 : 0.6};
        &:hover { opacity: 1; }
      `}
    >
      {icon}
    </button>
  );
}; 