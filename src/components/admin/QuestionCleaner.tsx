import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle, Play, Pause } from 'lucide-react';

const TOTAL_QUESTIONS = 21945;
const BATCH_SIZE = 200;

export const QuestionCleaner = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalUpdated, setTotalUpdated] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const runBatch = async (offset: number): Promise<{ nextOffset: number; done: boolean } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('clean-questions', {
        body: { batchSize: BATCH_SIZE, offset }
      });

      if (error) {
        addLog(`Error: ${error.message}`);
        return null;
      }

      if (data.success) {
        setTotalUpdated(prev => prev + (data.updated || 0));
        setTotalErrors(prev => prev + (data.errors || 0));
        addLog(`Batch ${offset}-${offset + BATCH_SIZE}: ${data.updated} updated, ${data.errors} errors`);
        
        return { nextOffset: data.nextOffset, done: data.done };
      } else {
        addLog(`Batch failed: ${data.error}`);
        return null;
      }
    } catch (err: any) {
      addLog(`Exception: ${err.message}`);
      return null;
    }
  };

  const startCleaning = async () => {
    setIsRunning(true);
    setIsPaused(false);
    setIsComplete(false);
    setLogs([]);
    setTotalUpdated(0);
    setTotalErrors(0);
    
    let offset = 0;
    setCurrentOffset(0);
    
    addLog('Starting question cleaning process...');
    toast.info('Starting question cleaning...');

    while (!isPaused) {
      const result = await runBatch(offset);
      
      if (!result) {
        // Error occurred, wait and retry
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      offset = result.nextOffset;
      setCurrentOffset(offset);

      if (result.done) {
        setIsComplete(true);
        setIsRunning(false);
        addLog('All questions cleaned successfully!');
        toast.success('Question cleaning complete!');
        break;
      }

      // Small delay between batches to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const pauseCleaning = () => {
    setIsPaused(true);
    setIsRunning(false);
    addLog('Cleaning paused.');
    toast.info('Cleaning paused');
  };

  const resumeCleaning = async () => {
    setIsPaused(false);
    setIsRunning(true);
    addLog(`Resuming from offset ${currentOffset}...`);
    
    let offset = currentOffset;

    while (!isPaused) {
      const result = await runBatch(offset);
      
      if (!result) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      offset = result.nextOffset;
      setCurrentOffset(offset);

      if (result.done) {
        setIsComplete(true);
        setIsRunning(false);
        addLog('All questions cleaned successfully!');
        toast.success('Question cleaning complete!');
        break;
      }

      await new Promise(r => setTimeout(r, 500));
    }
  };

  const progress = Math.min((currentOffset / TOTAL_QUESTIONS) * 100, 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : isRunning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : totalErrors > 0 ? (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          ) : null}
          Question Cleaner
        </CardTitle>
        <CardDescription>
          Clean and normalize all {TOTAL_QUESTIONS.toLocaleString()} questions in the database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!isRunning && !isComplete && (
            <Button onClick={isPaused ? resumeCleaning : startCleaning}>
              <Play className="h-4 w-4 mr-2" />
              {isPaused ? 'Resume' : 'Start Cleaning'}
            </Button>
          )}
          {isRunning && (
            <Button variant="outline" onClick={pauseCleaning}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {isComplete && (
            <Button variant="outline" onClick={() => {
              setIsComplete(false);
              setCurrentOffset(0);
              setTotalUpdated(0);
              setTotalErrors(0);
              setLogs([]);
            }}>
              Reset
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress: {currentOffset.toLocaleString()} / {TOTAL_QUESTIONS.toLocaleString()}</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <div className="text-green-600 font-medium">Updated</div>
            <div className="text-2xl font-bold">{totalUpdated.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <div className="text-red-600 font-medium">Errors</div>
            <div className="text-2xl font-bold">{totalErrors.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">Logs will appear here...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-muted-foreground">{log}</div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
