"use client";

import { useState, useEffect } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useRouter } from "next/navigation";
import "./hot.css";

interface HotTopic {
  id: string;
  title: string;
  description: string;
  category: "trending" | "popular" | "featured";
  views: number;
  engagement: number;
  trend: "up" | "down" | "stable";
  tags: string[];
  createdAt: string;
}

export default function HotPage() {
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "trending" | "popular" | "featured">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const mockData: HotTopic[] = [
      {
        id: "1",
        title: "AI Voice Agents Revolution",
        description: "How Eburon AI is transforming customer service with intelligent voice agents",
        category: "trending",
        views: 15420,
        engagement: 89,
        trend: "up",
        tags: ["AI", "Voice", "CSR"],
        createdAt: "2026-02-20T10:00:00Z"
      },
      {
        id: "2",
        title: "Multi-Tenant Architecture Best Practices",
        description: "Building scalable CSR platforms with modern architecture patterns",
        category: "featured",
        views: 12350,
        engagement: 92,
        trend: "up",
        tags: ["Architecture", "SaaS", "Scale"],
        createdAt: "2026-02-19T14:30:00Z"
      },
      {
        id: "3",
        title: "Real-Time Voice Processing",
        description: "Low-latency voice processing for seamless customer interactions",
        category: "popular",
        views: 18900,
        engagement: 85,
        trend: "stable",
        tags: ["Real-time", "Voice", "Performance"],
        createdAt: "2026-02-18T09:15:00Z"
      },
      {
        id: "4",
        title: "Integration Strategies for Modern CRM",
        description: "Connecting voice agents with existing CRM systems effectively",
        category: "trending",
        views: 11200,
        engagement: 78,
        trend: "up",
        tags: ["CRM", "Integration", "API"],
        createdAt: "2026-02-17T16:45:00Z"
      },
      {
        id: "5",
        title: "Voice Biometrics Security",
        description: "Implementing secure voice authentication in CSR applications",
        category: "featured",
        views: 9800,
        engagement: 81,
        trend: "down",
        tags: ["Security", "Biometrics", "Authentication"],
        createdAt: "2026-02-16T11:20:00Z"
      }
    ];

    setTimeout(() => {
      setHotTopics(mockData);
      setIsLoading(false);
    }, 1000);
  }, []);

  const filteredTopics = selectedCategory === "all" 
    ? hotTopics 
    : hotTopics.filter(topic => topic.category === selectedCategory);

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up": return "📈";
      case "down": return "📉";
      case "stable": return "➡️";
    }
  };

  const formatViews = (views: number) => {
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  if (isLoading) {
    return (
      <div className="hotContainer">
        <div className="loadingState">
          <div className="loadingSpinner"></div>
          <p>Loading hot topics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hotContainer">
      <div className="hotHeader">
        <h1 className="hotTitle">🔥 Hot Topics</h1>
        <p className="hotSubtitle">Trending discussions and popular content in the Eburon community</p>
      </div>

      <div className="categoryTabs">
        <button
          className={`categoryTab ${selectedCategory === "all" ? "active" : ""}`}
          onClick={() => setSelectedCategory("all")}
        >
          All Topics
        </button>
        <button
          className={`categoryTab ${selectedCategory === "trending" ? "active" : ""}`}
          onClick={() => setSelectedCategory("trending")}
        >
          🔥 Trending
        </button>
        <button
          className={`categoryTab ${selectedCategory === "popular" ? "active" : ""}`}
          onClick={() => setSelectedCategory("popular")}
        >
          ⭐ Popular
        </button>
        <button
          className={`categoryTab ${selectedCategory === "featured" ? "active" : ""}`}
          onClick={() => setSelectedCategory("featured")}
        >
          ✨ Featured
        </button>
      </div>

      <div className="topicsGrid">
        {filteredTopics.map((topic) => (
          <div key={topic.id} className="topicCard">
            <div className="topicHeader">
              <div className={`topicCategory ${topic.category}`}>
                {topic.category.charAt(0).toUpperCase() + topic.category.slice(1)}
              </div>
              <div className="topicTrend">
                {getTrendIcon(topic.trend)}
              </div>
            </div>
            
            <h3 className="topicTitle">{topic.title}</h3>
            <p className="topicDescription">{topic.description}</p>
            
            <div className="topicTags">
              {topic.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
            
            <div className="topicStats">
              <div className="stat">
                <span className="statLabel">Views</span>
                <span className="statValue">{formatViews(topic.views)}</span>
              </div>
              <div className="stat">
                <span className="statLabel">Engagement</span>
                <span className="statValue">{topic.engagement}%</span>
              </div>
            </div>
            
            <div className="topicFooter">
              <span className="topicDate">
                {new Date(topic.createdAt).toLocaleDateString()}
              </span>
              <button className="readMoreBtn">
                Read More →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
