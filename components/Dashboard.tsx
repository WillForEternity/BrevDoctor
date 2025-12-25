"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { SignInButton } from "./SignInButton";
import { AboutCreators } from "./AboutCreators";
import { RepoSelector } from "./RepoSelector";
import { RepoConfirmation } from "./RepoConfirmation";
import { AgentInsights } from "./AgentInsights";
import { ConfirmationCard } from "./ConfirmationCard";
import { ResultCard } from "./ResultCard";
import { FeedbackChat } from "./FeedbackChat";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { confirmAndCreatePR, type LaunchableResult, type AnalysisResult } from "@/app/dashboard/actions/createLaunchable";
import type { RepoMeta } from "@/types/agentSchemas";

type DashboardState = "idle" | "repo_selected" | "analyzing" | "confirming" | "feedback" | "reanalyzing" | "creating_pr" | "complete";

interface FeedbackMessage {
  role: "user" | "assistant";
  content: string;
}

export function Dashboard() {
  const { data: session, status } = useSession();
  const [dashboardState, setDashboardState] = useState<DashboardState>("idle");
  const [repoMeta, setRepoMeta] = useState<RepoMeta | null>(null);
  const [selectedRepoDescription, setSelectedRepoDescription] = useState<string | undefined>(undefined);
  const [prResult, setPrResult] = useState<LaunchableResult | null>(null);
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([]);
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  
  const { state: streamState, startAnalysis, reset: resetStream } = useAnalysisStream();

  const handleRepoSelect = (repo: RepoMeta, description?: string) => {
    setRepoMeta(repo);
    setSelectedRepoDescription(description);
    setDashboardState("repo_selected");
  };

  const handleConfirmAnalysis = async () => {
    if (!repoMeta) return;
    setDashboardState("analyzing");
    await startAnalysis(repoMeta);
  };

  // Watch for stream completion
  const isAnalysisComplete = !streamState.isStreaming && streamState.result !== null;
  
  // When analysis completes, transition to confirming state
  if (dashboardState === "analyzing" && isAnalysisComplete && streamState.result?.success) {
    setDashboardState("confirming");
  } else if (dashboardState === "analyzing" && isAnalysisComplete && !streamState.result?.success) {
    // Analysis failed
    setPrResult({
      success: false,
      error: streamState.error || "Analysis failed",
      recommendation: streamState.result?.recommendation,
      match: streamState.result?.match,
      needs: streamState.result?.needs,
      agentSteps: streamState.agentSteps,
    });
    setDashboardState("complete");
  } else if (dashboardState === "reanalyzing" && isAnalysisComplete && streamState.result?.success) {
    // Reanalysis complete after feedback
    setDashboardState("confirming");
    setIsProcessingFeedback(false);
  } else if (dashboardState === "reanalyzing" && isAnalysisComplete && !streamState.result?.success) {
    // Reanalysis failed
    setIsProcessingFeedback(false);
    setDashboardState("feedback");
  }

  const handleConfirmPR = async () => {
    if (!streamState.result?.match?.best || !streamState.result?.needs || !repoMeta) return;

    setDashboardState("creating_pr");

    const result = await confirmAndCreatePR(
      repoMeta,
      streamState.result.needs,
      streamState.result.match.best
    );
    
    setPrResult({
      ...result,
      recommendation: streamState.result.recommendation,
      match: streamState.result.match,
      agentSteps: [...streamState.agentSteps, ...result.agentSteps],
    });
    setDashboardState("complete");
  };

  const handleCancelAnalysis = () => {
    setDashboardState("idle");
    setRepoMeta(null);
    setSelectedRepoDescription(undefined);
    resetStream();
  };

  const handleDenyPR = () => {
    setDashboardState("idle");
    setRepoMeta(null);
    setSelectedRepoDescription(undefined);
    resetStream();
  };

  const handleReset = () => {
    setDashboardState("idle");
    setPrResult(null);
    setRepoMeta(null);
    setSelectedRepoDescription(undefined);
    setFeedbackMessages([]);
    setIsProcessingFeedback(false);
    resetStream();
  };

  const handleRejectAndFeedback = () => {
    setDashboardState("feedback");
    setFeedbackMessages([]);
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    if (!repoMeta || !streamState.result?.needs) return;

    // Add user message to chat
    const userMessage: FeedbackMessage = { role: "user", content: feedback };
    setFeedbackMessages((prev) => [...prev, userMessage]);
    setIsProcessingFeedback(true);
    setDashboardState("reanalyzing");

    // Call reanalysis with feedback
    try {
      await startAnalysis(repoMeta, feedback, streamState.result.needs);
      // After reanalysis completes, add assistant message
      const assistantMessage: FeedbackMessage = {
        role: "assistant",
        content: "I've updated my analysis based on your feedback. Please review the new recommendation.",
      };
      setFeedbackMessages((prev) => [...prev, assistantMessage]);
      setIsProcessingFeedback(false);
    } catch (error) {
      const errorMessage: FeedbackMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error while reanalyzing. Please try again.",
      };
      setFeedbackMessages((prev) => [...prev, errorMessage]);
      setIsProcessingFeedback(false);
      setDashboardState("feedback");
    }
  };

  const handleCancelFeedback = () => {
    setDashboardState("confirming");
    setFeedbackMessages([]);
  };

  // Build analysis result for ConfirmationCard
  const analysisForConfirmation: AnalysisResult | null = streamState.result ? {
    success: streamState.result.success,
    match: streamState.result.match,
    needs: streamState.result.needs,
    recommendation: streamState.result.recommendation,
    agentSteps: streamState.agentSteps,
  } : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent rotate-12 animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-teal-500/5 via-transparent to-transparent -rotate-12 animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950" />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-zinc-800/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Brev Doctor
              </h1>
              <p className="text-xs text-zinc-500">AI-Powered GPU Provisioning</p>
            </div>
          </div>
          {session ? <SignInButton /> : <AboutCreators />}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {status === "loading" ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        ) : !session ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="mb-8">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6 mx-auto border border-emerald-500/30">
                <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Analyze Your ML Repository
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-lg leading-relaxed">
                Brev Doctor scans your codebase, estimates GPU requirements, and automatically creates a PR with the perfect Brev.dev configuration.
              </p>
            </div>
            <SignInButton />
            
            {/* Feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl">
              {[
                {
                  icon: "🔍",
                  title: "Smart Analysis",
                  description: "AI scouts your repo for configs, dependencies, and model architectures",
                },
                {
                  icon: "🎯",
                  title: "GPU Matching",
                  description: "Recommends the perfect GPU from L4 to H100 based on your needs",
                },
                {
                  icon: "🚀",
                  title: "One-Click Deploy",
                  description: "Creates a PR with setup scripts ready for Brev.dev",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm hover:border-emerald-500/30 transition-colors duration-300"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-zinc-200 mb-2">{feature.title}</h3>
                  <p className="text-zinc-500 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {dashboardState === "idle" && (
              <div className="text-center w-full">
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                  Select a Repository
                </h2>
                <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                  Choose a repository to analyze GPU requirements and configure for Brev.dev
                </p>
                <div className="flex justify-center">
                  <RepoSelector onSubmit={handleRepoSelect} isLoading={false} />
                </div>
              </div>
            )}

            {dashboardState === "repo_selected" && repoMeta && (
              <div className="text-center w-full">
                <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                  Confirm Analysis
                </h2>
                <div className="flex justify-center">
                  <RepoConfirmation
                    repoName={repoMeta.repo}
                    repoOwner={repoMeta.owner}
                    repoDescription={selectedRepoDescription}
                    onConfirm={handleConfirmAnalysis}
                    onCancel={handleCancelAnalysis}
                  />
                </div>
              </div>
            )}

            {dashboardState === "analyzing" && (
              <div className="w-full">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                    Analyzing {repoMeta?.owner}/{repoMeta?.repo}
                  </h2>
                  <p className="text-zinc-500">Watch the AI agents work in real-time</p>
                </div>
                <div className="flex justify-center">
                  <AgentInsights 
                    steps={streamState.agentSteps}
                    streamingData={{
                      scoutReasoning: streamState.scoutReasoning,
                      scoutSelectedFiles: streamState.scoutSelectedFiles,
                      specialistThinking: streamState.specialistThinking,
                      specialistVram: streamState.specialistVram,
                      specialistArch: streamState.specialistArch,
                      specialistMultiGpu: streamState.specialistMultiGpu,
                      specialistCommands: streamState.specialistCommands,
                      specialistComplexity: streamState.specialistComplexity,
                      specialistComplexityReasoning: streamState.specialistComplexityReasoning,
                      specialistCpuCores: streamState.specialistCpuCores,
                      specialistSystemRam: streamState.specialistSystemRam,
                      specialistDiskSpace: streamState.specialistDiskSpace,
                      brokerThinking: streamState.brokerThinking,
                      brokerRecommendedInstance: streamState.brokerRecommendedInstance,
                      brokerAlternativeInstance: streamState.brokerAlternativeInstance,
                      brokerConfidence: streamState.brokerConfidence,
                      brokerCostNotes: streamState.brokerCostNotes,
                    }}
                  />
                </div>
                
                {streamState.error && (
                  <div className="mt-8 flex justify-center">
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 max-w-xl">
                      {streamState.error}
                    </div>
                  </div>
                )}
              </div>
            )}

            {dashboardState === "confirming" && analysisForConfirmation && (
              <div className="w-full">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                    Analysis Complete
                  </h2>
                  <p className="text-zinc-500">Review the AI's findings and recommendation</p>
                </div>
                
                {/* Two column layout: Agent Insights + Confirmation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <AgentInsights steps={streamState.agentSteps} />
                  <ConfirmationCard 
                    analysis={analysisForConfirmation} 
                    onConfirm={handleConfirmPR} 
                    onDeny={handleDenyPR}
                    onReject={handleRejectAndFeedback}
                    isCreatingPR={dashboardState === "creating_pr"}
                  />
                </div>
              </div>
            )}

            {dashboardState === "feedback" && (
              <div className="w-full">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                    Provide Feedback
                  </h2>
                  <p className="text-zinc-500">Let the AI know what needs to be adjusted</p>
                </div>
                
                <div className="flex justify-center">
                  <FeedbackChat
                    messages={feedbackMessages}
                    isProcessing={isProcessingFeedback}
                    onSubmitFeedback={handleFeedbackSubmit}
                    onCancel={handleCancelFeedback}
                  />
                </div>
              </div>
            )}

            {dashboardState === "reanalyzing" && (
              <div className="w-full">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                    Reanalyzing with Your Feedback
                  </h2>
                  <p className="text-zinc-500">The AI is updating its analysis based on your input</p>
                </div>
                <div className="flex justify-center">
                  <AgentInsights 
                    steps={streamState.agentSteps}
                    streamingData={{
                      scoutReasoning: streamState.scoutReasoning,
                      scoutSelectedFiles: streamState.scoutSelectedFiles,
                      specialistThinking: streamState.specialistThinking,
                      specialistVram: streamState.specialistVram,
                      specialistArch: streamState.specialistArch,
                      specialistMultiGpu: streamState.specialistMultiGpu,
                      specialistCommands: streamState.specialistCommands,
                      specialistComplexity: streamState.specialistComplexity,
                      specialistComplexityReasoning: streamState.specialistComplexityReasoning,
                      specialistCpuCores: streamState.specialistCpuCores,
                      specialistSystemRam: streamState.specialistSystemRam,
                      specialistDiskSpace: streamState.specialistDiskSpace,
                      brokerThinking: streamState.brokerThinking,
                      brokerRecommendedInstance: streamState.brokerRecommendedInstance,
                      brokerAlternativeInstance: streamState.brokerAlternativeInstance,
                      brokerConfidence: streamState.brokerConfidence,
                      brokerCostNotes: streamState.brokerCostNotes,
                    }}
                  />
                </div>
              </div>
            )}

            {dashboardState === "creating_pr" && analysisForConfirmation && (
              <div className="w-full">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                    Creating Pull Request...
                  </h2>
                  <p className="text-zinc-500">Generating configuration files</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <AgentInsights steps={streamState.agentSteps} />
                  <ConfirmationCard 
                    analysis={analysisForConfirmation} 
                    onConfirm={handleConfirmPR} 
                    onDeny={handleDenyPR}
                    onReject={handleRejectAndFeedback}
                    isCreatingPR={true}
                  />
                </div>
              </div>
            )}

            {dashboardState === "complete" && prResult && (
              <div className="w-full">
                {prResult.success ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <AgentInsights steps={prResult.agentSteps} />
                    <ResultCard result={prResult} onReset={handleReset} />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <ResultCard result={prResult} onReset={handleReset} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/50 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-zinc-500 text-sm">
          Powered by <span className="text-emerald-400">Brev.dev</span> • Built with Next.js & Vercel AI SDK
        </div>
      </footer>
    </div>
  );
}
