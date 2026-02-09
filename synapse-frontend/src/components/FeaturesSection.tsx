import { motion } from 'framer-motion';
import { 
  Circle, 
  Brain, 
  Users, 
  FileSearch,
  GitBranch,
  Search
} from 'lucide-react';

const features = [
  {
    title: 'Semantic clustering',
    description: 'Similar content automatically groups together. Your knowledge self-organizes without manual effort.',
    icon: Circle,
  },
  {
    title: 'AI embeddings',
    description: 'Every note, link, and document is converted to meaning. Connections form automatically.',
    icon: Brain,
  },
  {
    title: 'Visual connections',
    description: 'See relationships between ideas at a glance. Navigate complex information with ease.',
    icon: GitBranch,
  },
  {
    title: 'File intelligence',
    description: 'Drop PDFs, images, and documents. Content is extracted and indexed for search.',
    icon: FileSearch,
  },
  {
    title: 'Powerful search',
    description: 'Find anything by meaning, not just keywords. Semantic search understands context.',
    icon: Search,
  },
  {
    title: 'Team collaboration',
    description: 'Work together in real-time. See changes as they happen across your workspace.',
    icon: Users,
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 px-6 border-t border-border">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl font-semibold mb-3">
            Built for knowledge work
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Stop organizing manually. Let AI reveal the structure in your research.
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="p-5 rounded-lg border border-border bg-surface hover:bg-elevated transition-colors duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-md bg-background border border-border">
                  <feature.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-medium mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};