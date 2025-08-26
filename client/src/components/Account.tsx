import { useState, useEffect } from 'react';
import { Window } from './Windows';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Copy, LogOut, UserPlus } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface User {
  id: string;
  name: string;
  avatarUrl: string;
  privateKey: string;
}

export function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    // Load user from localStorage on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleCreateAccount = async () => {
    try {
      const privateKey = crypto.randomUUID();
      const newUser = { id: crypto.randomUUID(), name, avatarUrl, privateKey };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      setIsCreating(false);
      toast({ title: 'Account created', description: 'Your account has been created locally.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to create account.', variant: 'destructive' });
    }
  };

  const handleLogin = async (privateKey: string) => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        if (userObj.privateKey === privateKey) {
          setUser(userObj);
          toast({ title: 'Logged in', description: 'Local user loaded.' });
          return;
        }
      }
      toast({ title: 'Error', description: 'Invalid private key.', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'Failed to login.', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast({
      title: "Logged out",
      description: "You have been logged out.",
    });
  };

  const copyPrivateKey = () => {
    if (user?.privateKey) {
      navigator.clipboard.writeText(user.privateKey);
      toast({
        title: "Copied",
        description: "Private key copied to clipboard.",
      });
    }
  };

  return (
    <Window title="Account" windowId="account" defaultPosition={{ x: 100, y: 100 }}>
      <div className="p-4">
        {user ? (
          <Card>
            <CardHeader>
              <CardTitle>Your Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-4">
                <Avatar>
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Private Key</Label>
                  <div className="flex space-x-2">
                    <Input value={user.privateKey} readOnly />
                    <Button variant="outline" size="icon" onClick={copyPrivateKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isCreating ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <Label>Avatar URL</Label>
                  <Input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Enter avatar URL"
                  />
                </div>
                <Button onClick={handleCreateAccount}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Private Key</Label>
                  <Input
                    placeholder="Enter your private key"
                    onChange={(e) => handleLogin(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={() => setIsCreating(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create New Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Window>
  );
}