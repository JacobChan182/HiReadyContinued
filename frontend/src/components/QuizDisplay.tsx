import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { LatexRenderer } from './LatexRenderer'; // removed .tsx extension

// Updated interface to include the "details" array
interface QuizDisplayProps {
    quizContent: string | { questions: any[] };
    onClose: () => void;
    onFinish?: (results: { 
        score: number; 
        total: number; 
        percentage: number;
        details: Array<{
            question: string;
            isCorrect: number; // store 1 or 0
            userAnswer: string; // letter 'A' | 'B' | ...
        }>
    }) => void;
}

// Normalized internal types
type NormalizedOption = { letter: string; text: string };
type NormalizedQuestion = {
    question: string;
    options: NormalizedOption[];
    correctLetter: string;
    explanation?: string;
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const QuizDisplay = ({ quizContent, onClose, onFinish }: QuizDisplayProps) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [showResults, setShowResults] = useState(false);

    const questions = useMemo((): NormalizedQuestion[] => {
        const toOptions = (arr: string[]): NormalizedOption[] => {
            return arr.map((raw, i) => {
                const m = raw.match(/^\s*([A-Za-z])\)\s*(.*)$/);
                if (m && m[1]) {
                    const letter = m[1].toUpperCase();
                    const text = (m[2] ?? '').trim();
                    return { letter, text: text || raw.trim() };
                }
                return { letter: LETTERS[i] || String.fromCharCode(65 + i), text: raw.trim() };
            });
        };

        const normalizeCorrectLetter = (ca: any, opts: NormalizedOption[]): string => {
            if (typeof ca === 'number') {
                return opts[ca]?.letter || 'A';
            }
            if (typeof ca === 'string') {
                const s = ca.trim();
                // direct letter
                if (/^[A-Z]$/i.test(s)) return s.toUpperCase();
                // match by text (exact or trimmed)
                const hit = opts.find(o => o.text === s || o.text.replace(/^([A-Z])\)\s*/, '') === s);
                if (hit) return hit.letter;
            }
            return opts[0]?.letter || 'A';
        };

        // 1. Handle JSON Object Input
        if (typeof quizContent === 'object' && quizContent.questions) {
            return quizContent.questions.map((q: any) => {
                const optsText: string[] =
                    q.options ||
                    q.answerOptions?.map((o: any) => o.text) ||
                    [];
                const opts = toOptions(optsText);
                const ca =
                    q.correctAnswer ??
                    q.answerOptions?.find((o: any) => o.isCorrect)?.letter ??
                    q.answerOptions?.find((o: any) => o.isCorrect)?.text;
                const correctLetter = normalizeCorrectLetter(ca, opts);
                return {
                    question: q.question,
                    options: opts,
                    correctLetter,
                    explanation: q.explanation,
                };
            });
        }

        // 2. Handle string input - try JSON first
        if (typeof quizContent === 'string') {
            try {
                const parsed = JSON.parse(quizContent);
                if (parsed && Array.isArray(parsed.questions)) {
                    return parsed.questions.map((q: any) => {
                        const optsText: string[] =
                            q.options ||
                            q.answerOptions?.map((o: any) => o.text) ||
                            [];
                        const opts = toOptions(optsText);
                        const ca =
                            q.correctAnswer ??
                            q.answerOptions?.find((o: any) => o.isCorrect)?.letter ??
                            q.answerOptions?.find((o: any) => o.isCorrect)?.text;
                        const correctLetter = normalizeCorrectLetter(ca, opts);
                        return {
                            question: q.question,
                            options: opts,
                            correctLetter,
                            explanation: q.explanation,
                        };
                    });
                }
            } catch {
                // not JSON -> fall through to text parsing
            }

            // 3. Parse text/markdown with improved logic
            const content = String(quizContent);
            const questionList: NormalizedQuestion[] = [];

            // Split by "Question X:" or "Question X" patterns (more aggressive splitting)
            const questionPattern = /(?:^|\n)(?:###?\s*)?Question\s+(\d+)[:.)]?\s*(?:\n|$)/gi;
            const matches: RegExpExecArray[] = [];
            let match: RegExpExecArray | null;
            const pattern = new RegExp(questionPattern);
            
            while ((match = pattern.exec(content)) !== null) {
                matches.push(match);
            }
            
            if (matches.length === 0) {
                // Fallback: try splitting by numbered questions like "1. **Question**"
                const fallbackPattern = /(?:^|\n)\s*(\d+)\.\s*\*\*.+\*\*/gi;
                const fallbackMatches: RegExpExecArray[] = [];
                const fallbackPatternRegex = new RegExp(fallbackPattern);
                let fallbackMatch: RegExpExecArray | null;
                
                while ((fallbackMatch = fallbackPatternRegex.exec(content)) !== null) {
                    fallbackMatches.push(fallbackMatch);
                }
                
                if (fallbackMatches.length === 0) {
                    // Last resort: treat entire content as one question
                    const fakeMatch = /^/.exec(content);
                    if (fakeMatch) {
                        matches.push(fakeMatch);
                    }
                } else {
                    matches.push(...fallbackMatches);
                }
            }

            // Extract each question block
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                if (!match || match.index === undefined) continue;
                
                const nextMatch = matches[i + 1];
                const start = match.index + match[0].length; // Start after the "Question X:" header
                const end = nextMatch && nextMatch.index !== undefined ? nextMatch.index : content.length;
                const block = content.substring(start, end).trim();

                if (!block || block.length < 20) continue;

                const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

                let questionText = "";
                const rawOptions: string[] = [];
                let correctAnswerLetter = "";
                let parsingOptions = false;
                let foundAnswer = false;

                lines.forEach(line => {
                    // Skip empty lines and separators
                    if (!line || line.startsWith('---')) return;

                    // Stop parsing if we've already found the answer
                    if (foundAnswer) return;

                    // Remove segment name prefixes and "*Question:*" patterns
                    let cleanedLine = line
                        .replace(/^[^-]+\s*-\s*\*?Question:?\*?\s*/i, '') // Remove "Segment Name - *Question:*"
                        .replace(/^\*?Question:?\*?\s*/i, '') // Remove standalone "*Question:*" or "Question:"
                        .replace(/^[^-]+\s*-\s*/i, '') // Remove any remaining "Segment Name -" prefix
                        .trim();

                    if (!cleanedLine) return;

                    // Match answer keys like "**Answer:** B", "Answer: b", or "**Answer:** c) ..."
                    // Only match single letter answers (A, B, C, or D)
                    const answerMatch = cleanedLine.match(/(?:\*\*)?Answer:(?:\*\*)?\s*([A-Da-d])(?:\s|$|\)|\.)/i);
                    
                    if (answerMatch && !foundAnswer) {
                        correctAnswerLetter = answerMatch[1].toUpperCase();
                        foundAnswer = true;
                        // Stop parsing after finding the answer
                        return;
                    }

                    // Only parse options if we haven't found the answer yet
                    if (!foundAnswer) {
                        // Match options like "A) text", "a) text", or "- A) text"
                        const optionMatch = cleanedLine.match(/^[-*]?\s*([A-Da-d])\)\s*(.*)/);
                        
                        if (optionMatch) {
                            parsingOptions = true;
                            // Only add if we don't already have 4 options
                            if (rawOptions.length < 4) {
                                // Keep the full "A) ..." form so we can normalize letters reliably
                                rawOptions.push(`${optionMatch[1].toUpperCase()}) ${optionMatch[2] || ''}`.trim());
                            }
                        } else if (!parsingOptions) {
                            // If we haven't hit options yet, this is the question text
                            // Clean up any remaining markdown formatting
                            cleanedLine = cleanedLine.replace(/^\*\*|\*\*$/g, "").replace(/^_|_$/g, "");
                            if (cleanedLine.length > 0) {
                                questionText += (questionText ? " " : "") + cleanedLine;
                            }
                        }
                    }
                });

                // Only add question if we have both question text and options
                if (questionText && rawOptions.length >= 2 && rawOptions.length <= 4) {
                    const opts = toOptions(rawOptions);
                    const correctLetter = correctAnswerLetter || opts[0]?.letter || 'A';
                    questionList.push({
                        question: questionText.trim(),
                        options: opts,
                        correctLetter,
                    });
                }
            }

            return questionList;
        }

        return [];
    }, [quizContent]);

    const handleSelectAnswer = (letter: string) => {
        setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: letter });
    };

    const calculateScore = () => {
        return questions.reduce((score, q, idx) => {
            const userLetter = selectedAnswers[idx];
            return userLetter === q.correctLetter ? score + 1 : score;
        }, 0);
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            setShowResults(true);
        }
    };

    const handleRestart = () => {
        setCurrentQuestion(0);
        setSelectedAnswers({});
        setShowResults(false);
    };

    // Modified to create the detailed list of questions/correctness
    const handleCompleteQuiz = () => {
        const score = calculateScore();
        const total = questions.length;
        const percentage = Math.round((score / total) * 100);

        const detailedResults = questions.map((q, idx) => {
            const userLetter = selectedAnswers[idx];
            const isCorrectBinary = userLetter === q.correctLetter ? 1 : 0;
            return {
                question: q.question,
                isCorrect: isCorrectBinary,
                userAnswer: userLetter || '',
            };
        });

        if (onFinish) {
            onFinish({
                score,
                total,
                percentage,
                details: detailedResults
            });
        }
        onClose();
    };

    if (questions.length === 0) {
        return (
            <Card className="glass-card p-6 border-red-500/50 bg-red-500/5">
                <h3 className="text-xl font-bold mb-2">Quiz Parsing Error</h3>
                <p className="text-muted-foreground mb-4 text-sm">We couldn't automatically format the quiz.</p>
                <div className="bg-black/10 p-4 rounded-md text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto mb-4">
                    {String(quizContent)}
                </div>
                <Button onClick={onClose} variant="outline" className="w-full">Close</Button>
            </Card>
        );
    }

    if (showResults) {
        const score = calculateScore();
        const percentage = Math.round((score / questions.length) * 100);

        return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass-card p-6 border-primary/30">
                    <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold mb-2">Quiz Results</h3>
                        <div className="text-5xl font-extrabold gradient-text mb-2">{score} / {questions.length}</div>
                        <p className="text-muted-foreground">Accuracy: {percentage}%</p>
                    </div>

                    <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 text-left">
                        {questions.map((q, idx) => {
                            const userLetter = selectedAnswers[idx];
                            const isCorrect = userLetter === q.correctLetter;
                            const userOpt = q.options.find(o => o.letter === userLetter);
                            const correctOpt = q.options.find(o => o.letter === q.correctLetter);

                            return (
                                <div key={idx} className={`p-4 rounded-lg border ${isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                    <p className="font-medium text-sm mb-2">{q.question}</p>
                                    <div className="flex items-center gap-2 text-xs">
                                        {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                        <span>
                                            Your answer: {userOpt ? `${userOpt.letter}) ${userOpt.text}` : '—'}
                                        </span>
                                    </div>
                                    {!isCorrect && correctOpt && (
                                        <p className="text-xs text-green-600 mt-1 font-semibold">
                                            Correct: {correctOpt.letter}) {correctOpt.text}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={handleRestart} className="flex-1" variant="outline"><RotateCcw className="w-4 h-4 mr-2" /> Retry</Button>
                        <Button onClick={handleCompleteQuiz} className="flex-1 gradient-bg">Finish</Button>
                    </div>
                </Card>
            </motion.div>
        );
    }

    const currentQ = questions[currentQuestion];
    return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="glass-card p-6 border-primary/30 relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">Question {currentQuestion + 1} of {questions.length}</Badge>
                    <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQuestion}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="min-h-[200px]"
                    >
                        <h3 className="text-lg font-medium mb-6 text-left">
                            <LatexRenderer text={currentQ.question} />
                        </h3>
                        <div className="space-y-3">
                            {currentQ.options.map((opt) => (
                                <button
                                    key={opt.letter}
                                    onClick={() => handleSelectAnswer(opt.letter)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 text-sm ${
                                        selectedAnswers[currentQuestion] === opt.letter
                                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                            : 'border-border hover:border-primary/40 hover:bg-muted/50'
                                    }`}
                                >
                                    <LatexRenderer text={`${opt.letter}) ${opt.text}`} />
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
                    <Button
                        variant="ghost"
                        onClick={() => setCurrentQuestion(prev => prev - 1)}
                        disabled={currentQuestion === 0}
                    >
                        Back
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={!selectedAnswers[currentQuestion]}
                        className="px-8 gradient-bg"
                    >
                        {currentQuestion === questions.length - 1 ? 'See Results' : 'Next'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </Card>
        </motion.div>
    );
};

export default QuizDisplay;
