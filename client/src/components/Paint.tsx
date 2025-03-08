import { useState, useRef, useEffect } from 'react';
import { Window } from './Windows';
import { Eraser, Paintbrush } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HexColorPicker } from 'react-colorful';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CANVAS_SIZE = 256;
const DEFAULT_COLORS = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000'];
const MAX_RECENT_COLORS = 8;

// Custom styles to remove border-radius from react-colorful
const customColorfulStyles = `
  .react-colorful {
    border-radius: 0 !important;
  }
  .react-colorful__saturation {
    border-radius: 0 !important;
  }
  .react-colorful__hue {
    border-radius: 0 !important;
  }
  .react-colorful__interactive {
    border-radius: 0 !important;
  }
  .react-colorful__pointer {
    border-radius: 0 !important;
    transform: translate(-4px, -4px);
    width: 8px !important;
    height: 8px !important;
  }
`;

export function Paint() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [recentColors, setRecentColors] = useState<string[]>(DEFAULT_COLORS.slice(0, 8));
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [brushSize, setBrushSize] = useState(2);
  const { toast } = useToast();

  // Keep track of the currently used color
  const [lastDrawnColor, setLastDrawnColor] = useState<string | null>(null);

  // Handle color change from colorful
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setTool('brush');
  };

  // Add a color to recent colors list
  const addToRecentColors = (colorToAdd: string) => {
    setRecentColors(prev => {
      // Check if this color is already the most recent one
      if (prev[0]?.toLowerCase() === colorToAdd.toLowerCase()) {
        return prev;
      }
      
      // Remove the color if it already exists to avoid duplicates
      const filteredColors = prev.filter(c => c.toLowerCase() !== colorToAdd.toLowerCase());
      
      // Add the new color at the beginning
      const updatedColors = [colorToAdd, ...filteredColors];
      
      // Keep only up to MAX_RECENT_COLORS
      return updatedColors.slice(0, MAX_RECENT_COLORS);
    });
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setHasDrawing(false);
  };

  useEffect(() => {
    initCanvas();
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawing(true);
    
    // If we're actually drawing (not erasing) with a color different from the last one used,
    // update the last drawn color and add it to recent colors
    if (tool === 'brush' && color !== lastDrawnColor) {
      setLastDrawnColor(color);
      addToRecentColors(color);
    }
    
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    e.preventDefault();
    const { x, y } = getCoordinates(e);

    ctx.strokeStyle = tool === 'eraser' ? '#000000' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const saveDrawing = async () => {
    if (!hasDrawing) {
      toast({
        title: "Cannot save empty canvas",
        description: "Draw something first!",
        variant: "destructive"
      });
      return;
    }
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    if (!name || !author) {
      toast({
        title: "Missing information",
        description: "Please provide both name and author",
        variant: "destructive"
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const response = await fetch('/api/drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name,
        author,
        image: dataUrl 
      }),
    });

    if (response.ok) {
      toast({
        title: "Drawing saved",
        description: "Your masterpiece has been saved!"
      });
      setShowSaveDialog(false);
      setName('');
      setAuthor('');
      initCanvas();
    }
  };

  return (
    <>
      {/* Add custom styles for react-colorful */}
      <style dangerouslySetInnerHTML={{ __html: customColorfulStyles }} />
      
      <Window title="paint" windowId="paint" defaultPosition={{ x: 75, y: 305  }}>
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <button
              className={`cs-button ${tool === 'brush' ? 'border-cs-text' : ''}`}
              onClick={() => setTool('brush')}
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              className={`cs-button ${tool === 'eraser' ? 'border-cs-text' : ''}`}
              onClick={() => setTool('eraser')}
            >
              <Eraser className="w-4 h-4" />
            </button>
            <div 
              className="w-4 h-4 ml-auto border border-cs-border" 
              style={{ backgroundColor: color }}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="128"
              step="1"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-xs w-12 text-right">{brushSize}px</span>
          </div>

          <div className="flex gap-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="border border-cs-border cursor-crosshair touch-none flex-shrink-0"
              style={{ width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px` }}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
            />
            
            <div className="flex-shrink-0 pt-1 space-y-3">
              <HexColorPicker 
                color={color} 
                onChange={handleColorChange}
                style={{ 
                  width: '180px', 
                  height: '180px'
                }}
              />
              <div>
                <div className="text-xs mb-1 text-cs-text-secondary">Recent Colors</div>
                <div className="grid grid-cols-8 gap-1">
                  {recentColors.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      className={`w-5 h-5 border ${color === c ? 'border-cs-text' : 'border-cs-border'}`}
                      style={{ background: c }}
                      onClick={() => handleColorChange(c)}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-cs-text-secondary">HEX:</span>
                <Input
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-7 px-1 text-xs"
                />
              </div>
            </div>
          </div>

          <button 
            className={`cs-button w-full ${!hasDrawing ? 'opacity-50' : ''}`}
            onClick={saveDrawing}
          >
            Save Drawing
          </button>
        </div>
      </Window>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Drawing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Drawing Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter drawing name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author Name</Label>
              <Input
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Enter author name..."
              />
            </div>
          </div>
          <DialogFooter>
            <button className="cs-button" onClick={handleSave}>
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
