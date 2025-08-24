import { ScrollView, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import PredictionCard from '@/components/PredictionCard';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Heart, Share, Clock, Calendar, Users, ChevronUp, ChevronDown, Reply, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';

export default function EpisodeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [sortBy, setSortBy] = useState<'top' | 'new'>('top');
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  // Mock episode data
  const episode = {
    id: id as string,
    title: 'The Final Problem',
    showTitle: 'Sherlock',
    showId: 'sherlock',
    season: 4,
    episodeNumber: 3,
    airDate: 'Tonight 9:00 PM',
    description: 'Sherlock and John face their greatest challenge yet as Moriarty\'s final game begins. The detective\'s past comes back to haunt him in unexpected ways.',
    status: 'upcoming',
    totalPredictions: 12,
    totalComments: 47,
    timeLeft: '2h 15m',
  };

  const predictions: Array<{
    question: string;
    type: 'yes-no' | 'multiple-choice';
    status: 'open' | 'locked' | 'resolved';
    totalPredictions: number;
    timeLeft: string;
    votingData: { [key: string]: number };
    options?: string[];
  }> = [
    {
      question: 'Will Sherlock deduce Moriarty\'s final plan before the 30-minute mark?',
      type: 'yes-no',
      status: 'open',
      totalPredictions: 847,
      timeLeft: '2h 15m left',
      votingData: { 'Yes': 612, 'No': 235 },
    },
    {
      question: 'Who will survive the final confrontation?',
      type: 'multiple-choice',
      options: [
        'Both Sherlock and John',
        'Only Sherlock',
        'Only John',
        'Neither survives',
      ],
      status: 'open',
      totalPredictions: 623,
      timeLeft: '2h 15m left',
      votingData: { 
        'Both Sherlock and John': 389,
        'Only Sherlock': 112,
        'Only John': 78,
        'Neither survives': 44,
      },
    },
    {
      question: 'Will Mycroft reveal a major secret?',
      type: 'yes-no',
      status: 'open',
      totalPredictions: 412,
      timeLeft: '2h 15m left',
      votingData: { 'Yes': 287, 'No': 125 },
    },
  ];

  const comments = [
    {
      id: 1,
      username: 'DetectiveFan92',
      content: 'Anyone else think Moriarty\'s "death" was too convenient? There has to be more to this story. My theory is that he\'s been planning this final game for years.',
      timeAgo: '2h ago',
      upvotes: 23,
      downvotes: 2,
      replies: 5,
      hasUpvoted: false,
      isPredictionLinked: true,
      replyThread: [
        {
          id: 101,
          username: 'WatsonFan',
          content: 'Totally agree! The way he smiled before falling was too suspicious.',
          timeAgo: '1h ago',
          upvotes: 8,
          downvotes: 0,
        },
        {
          id: 102,
          username: 'MoriartyLives',
          content: 'I\'ve been saying this since S2! He had contingency plans for everything.',
          timeAgo: '45m ago',
          upvotes: 5,
          downvotes: 1,
        },
      ],
    },
    {
      id: 2,
      username: 'SherlockHolmes221',
      content: 'Based on the trailer, I\'m predicting a major character death. The music and cinematography suggest something tragic is coming.',
      timeAgo: '4h ago',
      upvotes: 18,
      downvotes: 3,
      replies: 3,
      hasUpvoted: true,
      isPredictionLinked: false,
      replyThread: [
        {
          id: 201,
          username: 'NoSpoilers',
          content: 'I hope it\'s not John! The trailer hints are making me nervous.',
          timeAgo: '3h ago',
          upvotes: 12,
          downvotes: 0,
        },
      ],
    },
    {
      id: 3,
      username: 'MysteryMaster',
      content: 'Called it! I predicted in S1 that Mycroft would be the real puppet master. Tonight we find out if I was right 🕵️',
      timeAgo: '6h ago',
      upvotes: 31,
      downvotes: 5,
      replies: 8,
      hasUpvoted: false,
      isPredictionLinked: true,
      replyThread: [],
    },
  ];

  const handleVote = (commentId: number, type: 'up' | 'down') => {
    // Handle voting logic
    console.log(`Voted ${type} on comment ${commentId}`);
  };

  const handlePostComment = () => {
    if (comment.trim()) {
      console.log('Posting comment:', comment);
      setComment('');
      // Here you would typically send the comment to your backend
    }
  };

  const handlePostReply = (parentId: number) => {
    if (replyText.trim()) {
      console.log('Posting reply to comment', parentId, ':', replyText);
      setReplyText('');
      setReplyingTo(null);
      // Here you would typically send the reply to your backend
    }
  };

  const toggleCommentExpansion = (commentId: number) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
      setReplyingTo(null); // Close reply box if collapsing
    } else {
      newExpanded.add(commentId);
    }
    setExpandedComments(newExpanded);
  };

  const handleReplyClick = (commentId: number) => {
    if (replyingTo === commentId) {
      setReplyingTo(null);
      setReplyText('');
    } else {
      setReplyingTo(commentId);
      setReplyText('');
      // Expand the comment if not already expanded
      if (!expandedComments.has(commentId)) {
        toggleCommentExpansion(commentId);
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `S${episode.season}E${episode.episodeNumber}`,
          headerRight: () => (
            <View className="flex-row gap-2 mr-4">
              <Button size="icon" variant="ghost">
                <Heart size={20} color="#fff" />
              </Button>
              <Button size="icon" variant="ghost">
                <Share size={20} color="#fff" />
              </Button>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
          <View className="px-4 py-6 pb-24">
            {/* Episode Header */}
            <View className="mb-6">
              <TouchableOpacity onPress={() => router.push(`/show/${episode.showId}` as any)}>
                <Text className="text-sm text-primary mb-1">{episode.showTitle}</Text>
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-foreground mb-2">
                {episode.title}
              </Text>
              <Text className="text-sm text-muted-foreground leading-5">
                {episode.description}
              </Text>
            </View>

            {/* Episode Meta */}
            <View className="flex-row items-center gap-4 mb-6">
              <View className="flex-row items-center gap-1">
                <Calendar size={16} color="#888" />
                <Text className="text-sm text-muted-foreground">{episode.airDate}</Text>
              </View>
              {episode.timeLeft && (
                <View className="flex-row items-center gap-1">
                  <Clock size={16} color="#888" />
                  <Text className="text-sm text-muted-foreground">{episode.timeLeft}</Text>
                </View>
              )}
            </View>

            {/* Episode Stats */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 bg-card border border-border rounded-xl p-3 items-center">
                <Text className="text-xl font-bold text-primary">{episode.totalPredictions}</Text>
                <Text className="text-xs text-muted-foreground">Predictions</Text>
              </View>
              <View className="flex-1 bg-card border border-border rounded-xl p-3 items-center">
                <Text className="text-xl font-bold text-primary">{episode.totalComments}</Text>
                <Text className="text-xs text-muted-foreground">Comments</Text>
              </View>
              <View className="flex-1 bg-card border border-border rounded-xl p-3 items-center">
                <Text className="text-xl font-bold text-primary">2.1K</Text>
                <Text className="text-xs text-muted-foreground">Views</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-2 mb-6">
              <Button className="flex-1 bg-primary">
                <Text className="text-primary-foreground">Make Prediction</Text>
              </Button>
              <Button variant="outline" size="icon">
                <Heart size={20} color="#fff" />
              </Button>
              <Button variant="outline" size="icon">
                <Share size={20} color="#fff" />
              </Button>
            </View>

            {/* Live Predictions */}
            <View className="mb-8">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-semibold text-foreground">Live Predictions</Text>
                <View className="bg-secondary px-2 py-1 rounded flex-row items-center gap-1">
                  <Clock size={10} color="#888" />
                  <Text className="text-xs">{episode.timeLeft} left</Text>
                </View>
              </View>
              
              <View className="gap-4">
                {predictions.map((prediction, index) => (
                  <PredictionCard key={index} {...prediction} />
                ))}
              </View>
            </View>

            {/* Discussion */}
            <View>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-semibold text-foreground">Discussion</Text>
                <View className="bg-card border border-border rounded-lg px-2 py-1 flex-row items-center gap-1">
                  <Users size={10} color="#888" />
                  <Text className="text-xs">{episode.totalComments}</Text>
                </View>
              </View>

              {/* Add Comment */}
              <View className="bg-card border border-border rounded-xl p-4 mb-4">
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share your theories and speculations..."
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={3}
                  className="text-foreground mb-3"
                  textAlignVertical="top"
                />
                <View className="flex-row items-center justify-end">
                  <Button 
                    size="sm" 
                    className="bg-primary"
                    onPress={handlePostComment}
                    disabled={!comment.trim()}
                  >
                    <Text className="text-primary-foreground text-xs">Post Comment</Text>
                  </Button>
                </View>
              </View>

              {/* Sort Options */}
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity onPress={() => setSortBy('top')}>
                  <View className={`px-3 py-1 rounded-lg ${sortBy === 'top' ? 'bg-primary' : 'bg-card border border-border'}`}>
                    <Text className={`text-sm ${sortBy === 'top' ? 'text-primary-foreground' : 'text-foreground'}`}>
                      Top
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSortBy('new')}>
                  <View className={`px-3 py-1 rounded-lg ${sortBy === 'new' ? 'bg-primary' : 'bg-card border border-border'}`}>
                    <Text className={`text-sm ${sortBy === 'new' ? 'text-primary-foreground' : 'text-foreground'}`}>
                      New
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Comments */}
              <View className="gap-3 mb-4">
                {comments.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    activeOpacity={0.95}
                    onPress={() => toggleCommentExpansion(item.id)}
                  >
                    <View className="bg-card border border-border rounded-xl p-4">
                      <View className="flex-row items-start gap-3">
                        <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                          <Text className="text-xs font-bold text-primary">
                            {item.username.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 mb-2">
                            <Text className="font-medium text-sm text-foreground">
                              {item.username}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              {item.timeAgo}
                            </Text>
                            {item.isPredictionLinked && (
                              <View className="bg-primary/20 px-2 py-0.5 rounded">
                                <Text className="text-[10px] text-primary">🎯 Linked</Text>
                              </View>
                            )}
                          </View>
                          
                          <Text className="text-sm text-foreground leading-5 mb-3">
                            {item.content}
                          </Text>
                          
                          <View className="flex-row items-center gap-4">
                            <TouchableOpacity onPress={(e) => {
                              e.stopPropagation();
                              handleVote(item.id, 'up');
                            }}>
                              <View className="flex-row items-center gap-1">
                                <ChevronUp size={16} color={item.hasUpvoted ? '#a855f7' : '#888'} />
                                <Text className={`text-xs ${item.hasUpvoted ? 'text-primary' : 'text-muted-foreground'}`}>
                                  {item.upvotes}
                                </Text>
                              </View>
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={(e) => {
                              e.stopPropagation();
                              handleVote(item.id, 'down');
                            }}>
                              <ChevronDown size={16} color="#888" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={(e) => {
                              e.stopPropagation();
                              handleReplyClick(item.id);
                            }}>
                              <View className="flex-row items-center gap-1">
                                <Reply size={14} color={replyingTo === item.id ? '#a855f7' : '#888'} />
                                <Text className={`text-xs ${replyingTo === item.id ? 'text-primary' : 'text-muted-foreground'}`}>
                                  Reply ({item.replies})
                                </Text>
                              </View>
                            </TouchableOpacity>
                          </View>

                          {/* Reply Thread */}
                          {expandedComments.has(item.id) && item.replyThread && item.replyThread.length > 0 && (
                            <View className="mt-4 pl-4 border-l-2 border-border/50">
                              {item.replyThread.map((reply) => (
                                <View key={reply.id} className="mb-3">
                                  <View className="flex-row items-start gap-2">
                                    <View className="w-6 h-6 bg-secondary rounded-full items-center justify-center">
                                      <Text className="text-[10px] font-bold text-foreground">
                                        {reply.username.substring(0, 2).toUpperCase()}
                                      </Text>
                                    </View>
                                    <View className="flex-1">
                                      <View className="flex-row items-center gap-2 mb-1">
                                        <Text className="font-medium text-xs text-foreground">
                                          {reply.username}
                                        </Text>
                                        <Text className="text-[10px] text-muted-foreground">
                                          {reply.timeAgo}
                                        </Text>
                                      </View>
                                      <Text className="text-xs text-foreground leading-4 mb-2">
                                        {reply.content}
                                      </Text>
                                      <View className="flex-row items-center gap-3">
                                        <TouchableOpacity onPress={(e) => {
                                          e.stopPropagation();
                                          handleVote(reply.id, 'up');
                                        }}>
                                          <View className="flex-row items-center gap-1">
                                            <ChevronUp size={12} color="#888" />
                                            <Text className="text-[10px] text-muted-foreground">
                                              {reply.upvotes}
                                            </Text>
                                          </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={(e) => {
                                          e.stopPropagation();
                                          handleVote(reply.id, 'down');
                                        }}>
                                          <ChevronDown size={12} color="#888" />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Reply Input Box */}
                          {replyingTo === item.id && (
                            <View className="mt-3 bg-secondary/20 rounded-lg p-3">
                              <TextInput
                                value={replyText}
                                onChangeText={setReplyText}
                                placeholder={`Reply to ${item.username}...`}
                                placeholderTextColor="#888"
                                multiline
                                numberOfLines={2}
                                className="text-foreground text-sm mb-2"
                                textAlignVertical="top"
                                autoFocus
                              />
                              <View className="flex-row items-center justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                >
                                  <Text className="text-xs text-muted-foreground">Cancel</Text>
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="bg-primary"
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handlePostReply(item.id);
                                  }}
                                  disabled={!replyText.trim()}
                                >
                                  <Text className="text-primary-foreground text-xs">Reply</Text>
                                </Button>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Load More */}
              <Button variant="outline" className="w-full mb-4">
                <Text>Load More Comments</Text>
              </Button>

              {/* Spoiler Warning */}
              <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 items-center">
                <Text className="text-sm font-medium text-red-500 mb-1">
                  ⚠️ Spoiler Free Zone
                </Text>
                <Text className="text-xs text-muted-foreground text-center">
                  Comments with spoilers will be hidden until after the episode airs
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}