import { useSimpleWallet } from "@/hooks/use-simple-wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";

interface WalletStatusProps {
  showFullStatus?: boolean;
}

export function WalletStatus({ showFullStatus = false }: WalletStatusProps) {
  const {
    isConnected,
    address,
    isConnecting,
    isOnCorrectNetwork,
    connectWallet,
    switchToBaseNetwork,
    formatAddress,
    usdcBalance,
    formatUSDC
  } = useSimpleWallet();

  if (!showFullStatus && isConnected && isOnCorrectNetwork) {
    return null;
  }

  return (
    <Card className="mb-6 border-orange-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Wallet className="w-5 h-5 text-orange-500" />
          <CardTitle className="text-lg">Wallet Connection</CardTitle>
        </div>
        <CardDescription>
          Connect your wallet to create listings on the blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">
                Wallet not connected
              </span>
            </div>
            <Button 
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Connecting Wallet...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Wallet Connected</span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {formatAddress(address)}
              </Badge>
            </div>

            {!isOnCorrectNetwork ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-500">
                    Wrong network - Please switch to Base
                  </span>
                </div>
                <Button 
                  onClick={switchToBaseNetwork}
                  variant="destructive"
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Switch to Base Network
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">
                    Connected to Base Network
                  </span>
                </div>
                {showFullStatus && (
                  <div className="bg-dark-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">USDC Balance:</span>
                      <span className="font-medium">{formatUSDC(usdcBalance)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}