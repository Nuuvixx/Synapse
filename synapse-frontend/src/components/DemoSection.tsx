import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, Circle, FileText } from 'lucide-react';
import { useState } from 'react';

interface DemoNote {
  id: number;
  text: string;
  x: number;
  y: number;
}

export const DemoSection = () => {
  const [notes, setNotes] = useState<DemoNote[]>([
    { id: 1, text: 'Research findings', x: 25, y: 30 },
    { id: 2, text: 'Technical specs', x: 55, y: 55 },
    { id: 3, text: 'User feedback', x: 70, y: 25 },
  ]);

  const addNote = () => {
    const labels = [
      'Meeting notes',
      'Project ideas',
      'Documentation',
      'Analysis',
      'References',
      'Action items',
    ];
    const newNote: DemoNote = {
      id: Date.now(),
      text: labels[Math.floor(Math.random() * labels.length)],
      x: 15 + Math.random() * 65,
      y: 15 + Math.random() * 60,
    };
    setNotes([...notes, newNote]);
  };

  return (
    <section id="demo" className="py-20 px-6 border-t border-border">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-semibold mb-3">
            Try the canvas
          </h2>
          <p className="text-muted-foreground">
            Add notes and drag them around. No signup required.
          </p>
        </motion.div>

        {/* Interactive canvas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative aspect-[16/10] rounded-lg border border-border bg-surface overflow-hidden"
        >
          {/* Grid background */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Notes */}
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="absolute p-3 rounded-md border border-border bg-background cursor-move select-none hover:border-border-strong transition-colors"
              style={{
                left: `${note.x}%`,
                top: `${note.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              drag
              dragMomentum={false}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">{note.text}</span>
              </div>
            </motion.div>
          ))}

          {/* Toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-md border border-border bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={addNote}
              className="gap-1.5 h-7 px-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Add note
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 px-2 text-muted-foreground"
            >
              <Circle className="w-3.5 h-3.5" />
              Cluster
            </Button>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-center mt-8"
        >
          <Button>
            Create workspace
          </Button>
        </motion.div>
      </div>
    </section>
  );
};