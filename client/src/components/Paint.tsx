import { useState, useRef, useEffect } from 'react';
import { Window } from './Windows';
import { Eraser, Paintbrush } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
const COLORS = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#000000'];

export function Paint() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const { toast } = useToast();

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

    e.preventDefault(); // Prevent scrolling on touch devices
    const { x, y } = getCoordinates(e);

    ctx.strokeStyle = tool === 'eraser' ? '#000000' : color;
    ctx.lineWidth = 2;
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
      <Window title="Paint" windowId="paint" defaultPosition={{ x: 400, y: 100 }}>
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <button
              className={`cs-button ${tool === 'brush' ? 'border-white' : ''}`}
              onClick={() => setTool('brush')}
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              className={`cs-button ${tool === 'eraser' ? 'border-white' : ''}`}
              onClick={() => setTool('eraser')}
            >
              <Eraser className="w-4 h-4" />
            </button>
            {COLORS.map((c) => (
              <button
                key={c}
                className={`w-6 h-6 border ${color === c ? 'border-white' : 'border-gray-600'}`}
                style={{ background: c }}
                onClick={() => {
                  setTool('brush');
                  setColor(c);
                }}
              />
            ))}
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="border border-cs-border cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
          />

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