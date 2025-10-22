import React, { useState } from "react";
import AdminLayout from "@/layouts/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, KeyRound, RotateCcw, Trash2, Search, Filter, Eye, Calendar, Shield, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { generateRandomKey } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
// Custom tabs implemented with buttons for better mobile control
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

// Define the form schema
const generateKeySchema = z.object({
  game: z.string().min(1, "Game selection is required"),
  deviceLimit: z.string().min(1, "Device limit is required"),
  days: z.number().min(1, "Must be at least 1 day").default(30),
  keyCount: z.number().min(1, "Must generate at least 1 key").default(1),
  customKey: z.string().optional(),
});

type GenerateKeyValues = z.infer<typeof generateKeySchema>;

export default function AdminCreateKeys() {
  const { toast } = useToast();
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"generate" | "manage">("generate");
  
  // State for key management
  const [searchQuery, setSearchQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);

  const form = useForm<GenerateKeyValues>({
    resolver: zodResolver(generateKeySchema),
    defaultValues: {
      game: "",
      deviceLimit: "1",
      days: 30,
      keyCount: 1,
      customKey: "",
    },
  });

  // Generate key mutation
  const generateKeyMutation = useMutation({
    mutationFn: async (values: GenerateKeyValues) => {
      try {
        // Parse the device limit as a number
        const deviceLimit = parseInt(values.deviceLimit);
        
        // Calculate expiry date based on days
        const today = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(today.getDate() + values.days);
        
        const payload = {
          game: values.game,
          deviceLimit: deviceLimit,
          expiryDate: expiryDate,
          keyString: values.customKey || undefined,
          count: values.keyCount,
        };
        
        console.log("Sending admin key generation payload:", payload);
        
        const response = await apiRequest("POST", "/api/admin/keys/generate", payload);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to generate key");
        }
        
        const data = await response.json();
        return data;
      } catch (error: any) {
        console.error("Admin key generation error:", error);
        throw new Error(error.message || "Failed to generate key");
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/keys'] });
      
      if (data.keys && data.keys.length > 0) {
        setGeneratedKeys(data.keys.map((key: any) => key.keyString));
        
        toast({
          title: "Success",
          description: `Generated ${data.keys.length} admin key(s) successfully`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate keys",
        variant: "destructive",
      });
    },
  });

  // Query for admin keys with filtering
  const { data: keysData, isLoading: keysLoading, refetch: refetchKeys } = useQuery({
    queryKey: ['/api/admin/keys/manage', { search: searchQuery, game: gameFilter, status: statusFilter }],
    enabled: activeTab === "manage",
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (gameFilter && gameFilter !== 'all') params.append('game', gameFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const url = `/api/admin/keys/manage${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
  });
  
  // Query for key details
  const { data: keyDetails, isLoading: keyDetailsLoading } = useQuery({
    queryKey: ['/api/admin/keys', selectedKeyId, 'details'],
    enabled: !!selectedKeyId,
    refetchOnWindowFocus: false,
  });
  
  // Revoke key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/keys/${keyId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to revoke key");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Key revoked successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/keys'] });
      refetchKeys();
      setSelectedKeyId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke key",
        variant: "destructive",
      });
    },
  });

  // Reset all keys mutation
  const resetAllKeysMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/keys/reset-devices");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reset devices");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Reset devices for ${data.resetCount} keys successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/keys'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resellers'] });
      refetchKeys();
    },
    onError: (error: Error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to reset all devices",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: GenerateKeyValues) {
    generateKeyMutation.mutate(values);
  }

  const handleGenerateRandomKey = () => {
    const game = form.getValues("game");
    if (!game) {
      toast({
        title: "Error",
        description: "Please select a game first",
        variant: "destructive",
      });
      return;
    }
    
    const randomKey = generateRandomKey(game);
    form.setValue("customKey", randomKey);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Key copied to clipboard",
    });
  };

  const handleResetAllKeys = () => {
    if (window.confirm("Are you sure you want to reset device links for ALL keys (admin and reseller)? This action cannot be undone.")) {
      resetAllKeysMutation.mutate();
    }
  };
  
  const handleRevokeKey = (keyId: number) => {
    if (window.confirm("Are you sure you want to revoke this key? This action cannot be undone.")) {
      revokeKeyMutation.mutate(keyId);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "EXPIRED":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case "REVOKED":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>;
    }
  };
  
  const filteredKeys = keysData?.keys || [];

  // Custom Modal Component - Bulletproof for both Desktop and Mobile
  const CustomKeyDetailsModal = ({ keyId, onClose }: { keyId: number | null; onClose: () => void }) => {
    if (!keyId) return null;

    const key = filteredKeys.find((k: any) => k.id === keyId);
    if (!key) return null;

    return (
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-start sm:items-center justify-center p-4"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          minHeight: '100dvh',
          paddingTop: 'max(1rem, env(safe-area-inset-top))'
        }}
        onClick={onClose}
      >
        <div 
          className="bg-gray-900 border border-purple-500/30 rounded-lg w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-purple-900/20">
            <h3 className="text-lg font-semibold text-purple-300">Key Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              data-testid="button-close-modal"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Key String */}
            <div>
              <label className="text-sm font-medium text-purple-300 block mb-2">Key String</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-800 text-green-400 p-2 rounded text-xs font-mono break-all">
                  {key.keyString}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(key.keyString);
                    toast({ title: "Copied", description: "Key copied to clipboard" });
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs"
                  data-testid="button-copy-key"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium text-purple-300 block mb-2">Status</label>
              {getStatusBadge(key.status)}
            </div>

            {/* Game */}
            <div>
              <label className="text-sm font-medium text-purple-300 block mb-2">Game</label>
              <p className="text-white">{key.game}</p>
            </div>

            {/* Device Usage */}
            <div>
              <label className="text-sm font-medium text-purple-300 block mb-2">Device Usage</label>
              <p className="text-white">{key.deviceCount || 0}/{key.deviceLimit} devices</p>
            </div>

            {/* Created Date */}
            <div>
              <label className="text-sm font-medium text-purple-300 block mb-2">Created At</label>
              <p className="text-white">{format(new Date(key.createdAt), 'MMM dd, yyyy')}</p>
            </div>

            {/* Expiry Date */}
            <div>
              <label className="text-sm font-medium text-purple-300 block mb-2">Expiry Date</label>
              <p className="text-white">{format(new Date(key.expiryDate), 'MMM dd, yyyy')}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-purple-500/20">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
                data-testid="button-close"
              >
                Close
              </button>
              <button
                onClick={() => handleRevokeKey(key.id)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
                data-testid="button-revoke"
              >
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-2 mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text text-transparent">Admin Key Management</h2>
        <p className="text-muted-foreground text-sm">Generate and manage admin license keys</p>
      </div>
      
      <div className="w-full">
        {/* Custom Tab Buttons - Mobile First Design */}
        <div className="mb-6 mx-2 sm:mx-0">
          <div className="flex w-full bg-purple-900/30 border border-purple-500/30 rounded-lg p-1 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab("generate")}
              className={`flex-1 h-12 px-4 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center ${
                activeTab === "generate"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-purple-300 hover:text-white hover:bg-purple-800/50"
              }`}
              data-testid="tab-generate"
            >
              <KeyRound className="w-4 h-4 mr-2 hidden sm:inline-block" />
              Generate
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`flex-1 h-12 px-4 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center ${
                activeTab === "manage"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-purple-300 hover:text-white hover:bg-purple-800/50"
              }`}
              data-testid="tab-manage"
            >
              <Shield className="w-4 h-4 mr-2 hidden sm:inline-block" />
              Manage
            </button>
          </div>
        </div>

        {activeTab === "generate" && (
        <div className="mt-0">
          {/* Reset All Keys Button */}
          <Card className="border border-red-500/20 shadow-lg shadow-red-500/5 overflow-hidden mb-6">
            <CardHeader className="px-6 py-4 border-b border-border bg-gradient-to-r from-red-900/20 to-orange-900/20">
              <CardTitle className="text-base font-medium bg-gradient-to-r from-red-500 to-orange-600 bg-clip-text text-transparent flex items-center">
                <Trash2 className="mr-2 h-5 w-5 text-red-500" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-red-400 mb-2">Reset All Key Devices</h3>
                  <p className="text-sm text-muted-foreground">
                    This will remove device links from ALL keys (admin and reseller), allowing them to be used on new devices.
                    <span className="block text-red-400 font-medium mt-1">⚠️ This action cannot be undone!</span>
                  </p>
                </div>
                <Button
                  onClick={handleResetAllKeys}
                  disabled={resetAllKeysMutation.isPending}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 glow-red"
                  data-testid="button-reset-all-keys"
                >
                  {resetAllKeysMutation.isPending ? (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      RESET ALL KEYS
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Key Generation */}
          <Card className="border border-purple-500/20 shadow-lg shadow-purple-500/5 overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-border bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
              <CardTitle className="text-base font-medium bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text text-transparent flex items-center">
                <KeyRound className="mr-2 h-5 w-5 text-purple-500" />
                Admin Key Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="game"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Game</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-game">
                              <SelectValue placeholder="Select a game" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PUBG MOBILE">PUBG MOBILE</SelectItem>
                            <SelectItem value="LAST ISLAND OF SURVIVAL">LAST ISLAND OF SURVIVAL</SelectItem>
                            <SelectItem value="FREE FIRE">FREE FIRE</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deviceLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device Limit</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-device-limit">
                              <SelectValue placeholder="Select device limit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 Device</SelectItem>
                            <SelectItem value="2">2 Devices</SelectItem>
                            <SelectItem value="5">5 Devices</SelectItem>
                            <SelectItem value="10">10 Devices</SelectItem>
                            <SelectItem value="100">100 Devices (Unlimited)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={field.value}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                field.onChange('' as any);
                              } else {
                                const parsed = parseInt(value);
                                if (!isNaN(parsed)) {
                                  field.onChange(parsed);
                                }
                              }
                            }}
                            className="focus:border-purple-500 focus:ring-purple-500"
                            data-testid="input-days"
                          />
                        </FormControl>
                        <FormDescription>
                          License will be valid for this many days from today
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="keyCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Keys</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              value={field.value}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  field.onChange('' as any);
                                } else {
                                  const parsed = parseInt(value);
                                  if (!isNaN(parsed)) {
                                    field.onChange(parsed);
                                  }
                                }
                              }}
                              className="focus:border-purple-500 focus:ring-purple-500"
                              data-testid="input-key-count"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Key (Optional)</FormLabel>
                          <div className="flex space-x-2">
                            <FormControl>
                              <Input
                                placeholder="Leave empty for auto-generate"
                                {...field}
                                className="focus:border-purple-500 focus:ring-purple-500"
                                data-testid="input-custom-key"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleGenerateRandomKey}
                              className="border-purple-500/30 text-purple-300 hover:bg-purple-900/40"
                              data-testid="button-generate-random"
                            >
                              Random
                            </Button>
                          </div>
                          <FormDescription>
                            Custom key will be used only for the first key if generating multiple
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Alert className="bg-purple-900/30 text-purple-100 border-purple-500/30">
                    <Info className="h-4 w-4 text-purple-400" />
                    <AlertTitle className="font-bold text-purple-300">Admin Key Generation</AlertTitle>
                    <AlertDescription className="text-purple-100">
                      As an admin, you can generate unlimited keys without credit restrictions.
                      <div className="mt-2 text-purple-200 font-medium">
                        Generating {form.watch("keyCount")} key(s) for {form.watch("game") || "selected game"}.
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6 glow disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={generateKeyMutation.isPending}
                    data-testid="button-generate-keys"
                  >
                    {generateKeyMutation.isPending
                      ? "Generating..."
                      : "✨ GENERATE ADMIN KEYS ✨"}
                  </Button>
                </form>
              </Form>

              {generatedKeys.length > 0 && (
                <div className="mt-6 p-4 border border-purple-500/30 rounded-md bg-gradient">
                  <h3 className="text-lg font-medium mb-4 text-purple-300">✨ Your Generated Admin Keys:</h3>
                  <div className="space-y-3">
                    {generatedKeys.map((key, index) => (
                      <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <code className="flex-1 font-mono text-sm bg-purple-900/40 text-purple-100 p-3 rounded-md border border-purple-500/20" data-testid={`generated-key-${index}`}>
                          {key}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-500/30 text-purple-300 hover:bg-purple-900/40 hover:text-purple-100"
                          onClick={() => copyToClipboard(key)}
                          data-testid={`button-copy-key-${index}`}
                        >
                          Copy Key
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-purple-300 opacity-70">Admin keys have been generated successfully. Remember to keep them secure.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === "manage" && (
        <div className="mt-0">
          <Card className="border border-purple-500/20 shadow-lg shadow-purple-500/5 overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-border bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
              <CardTitle className="text-base font-medium bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text text-transparent flex items-center">
                <Shield className="mr-2 h-5 w-5 text-purple-500" />
                Admin Key Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* Search and Filter Controls */}
              <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search keys by key string or game..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 focus:border-purple-500 focus:ring-purple-500"
                      data-testid="input-search-keys"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select value={gameFilter} onValueChange={setGameFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-game-filter">
                      <SelectValue placeholder="Filter by game" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Games</SelectItem>
                      <SelectItem value="PUBG MOBILE">PUBG MOBILE</SelectItem>
                      <SelectItem value="LAST ISLAND OF SURVIVAL">LAST ISLAND OF SURVIVAL</SelectItem>
                      <SelectItem value="FREE FIRE">FREE FIRE</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="REVOKED">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Keys List */}
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <span className="ml-3 text-muted-foreground">Loading keys...</span>
                </div>
              ) : filteredKeys.length === 0 ? (
                <div className="text-center py-8">
                  <KeyRound className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No keys found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || gameFilter !== "all" || statusFilter !== "all" 
                      ? "Try adjusting your search or filter criteria."
                      : "Generate your first admin key using the Generate tab."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredKeys.map((key: any) => (
                    <div key={key.id} className="border border-purple-500/20 rounded-lg bg-gradient-to-r from-purple-900/10 to-indigo-900/10 p-4 transition-all duration-200 hover:from-purple-900/20 hover:to-indigo-900/20">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <code className="font-mono text-sm bg-purple-900/30 text-purple-100 px-2 py-1 rounded border border-purple-500/30" data-testid={`key-string-${key.id}`}>
                              {key.keyString}
                            </code>
                            {getStatusBadge(key.status)}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-purple-400" />
                              <span data-testid={`key-expiry-${key.id}`}>{format(new Date(key.expiryDate), 'MMM dd, yyyy')}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="w-4 h-4 mr-2 text-purple-400 font-bold">G</span>
                              <span data-testid={`key-game-${key.id}`}>{key.game}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="w-4 h-4 mr-2 text-purple-400 font-bold">D</span>
                              <span data-testid={`key-devices-${key.id}`}>{key.deviceCount}/{key.deviceLimit} devices</span>
                            </div>
                            {key.status === "ACTIVE" && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2 text-green-400" />
                                <span className="text-green-400" data-testid={`key-days-remaining-${key.id}`}>{key.daysRemaining} days left</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-500/30 text-purple-300 hover:bg-purple-900/40 hover:text-purple-100"
                                onClick={() => setSelectedKeyId(key.id)}
                                data-testid={`button-view-details-${key.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Details
                              </Button>
                          {key.status !== "REVOKED" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevokeKey(key.id)}
                              disabled={revokeKeyMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                              data-testid={`button-revoke-${key.id}`}
                            >
                              {revokeKeyMutation.isPending ? (
                                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                              )}
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {keysData && keysData.totalCount > 0 && (
                <div className="mt-6 p-4 border border-purple-500/20 rounded-lg bg-gradient-to-r from-purple-900/10 to-indigo-900/10">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Showing {filteredKeys.length} of {keysData.totalCount} total admin keys
                    </span>
                    {(searchQuery || gameFilter !== "all" || statusFilter !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setGameFilter("all");
                          setStatusFilter("all");
                        }}
                        className="text-purple-300 hover:text-purple-100 hover:bg-purple-900/40"
                        data-testid="button-clear-filters"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* Custom Key Details Modal */}
        <CustomKeyDetailsModal 
          keyId={selectedKeyId} 
          onClose={() => setSelectedKeyId(null)} 
        />
      </div>
    </AdminLayout>
  );
}