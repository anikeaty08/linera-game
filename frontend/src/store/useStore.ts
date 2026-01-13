import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { GameAPI } from '../services/api.ts'

// Types
interface UserProfile {
  username: string
  ethAddress: string
  avatarUrl: string
  createdAt: number
  lastActive: number
  chessWins: number
  chessLosses: number
  chessDraws: number
  chessElo: number
  pokerWins: number
  pokerLosses: number
  pokerChipsWon: number
  pokerBestHand: string
  blackjackWins: number
  blackjackLosses: number
  blackjackPushes: number
  blackjackChipsWon: number
  blackjackNaturals: number
  totalGames: number
  currentStreak: number
  bestStreak: number
}

interface GameState {
  gameId: string
  gameType: 'chess' | 'poker' | 'blackjack'
  gameMode: 'bot' | 'friend' | 'local'
  status: 'waiting' | 'playing' | 'finished'
  players: string[]
  playerNames: string[]
  winner?: number
}

interface Toast {
  message: string
  type: 'success' | 'error' | 'info'
}

interface StoreState {
  // Wallet State
  isConnected: boolean
  ethAddress: string | null
  lineraPublicKey: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null

  // User State
  userProfile: UserProfile | null
  isRegistered: boolean
  isLoading: boolean

  // Game State
  currentGame: GameState | null
  activeGames: GameState[]

  // UI State
  toast: Toast | null

  // Actions
  connectWallet: () => Promise<boolean>
  disconnectWallet: () => void
  checkWalletConnection: () => Promise<void>
  setUserProfile: (profile: UserProfile) => void
  refreshProfile: () => Promise<void>
  registerUser: (username: string) => Promise<boolean>
  updateUsername: (username: string) => Promise<boolean>
  setCurrentGame: (game: GameState | null) => void
  setActiveGames: (games: GameState[]) => void
  showToast: (message: string, type: Toast['type']) => void
  hideToast: () => void
  generateLineraWallet: () => Promise<string | null>
}

// Blockchain config - Conway Testnet
const LINERA_ENDPOINT = import.meta.env.VITE_LINERA_ENDPOINT || 'http://localhost:8080'
const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || '81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9'
const APP_ID = import.meta.env.VITE_APP_ID || '81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9'

// Simple key generation (in production, use proper Ed25519)
function generateKeyPair(): { publicKey: string; privateKey: string } {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const privateKey = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')

  // Simple derivation (in production, use proper Ed25519)
  const publicArray = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    publicArray[i] = array[i] ^ 0x5a
  }
  const publicKey = Array.from(publicArray).map(b => b.toString(16).padStart(2, '0')).join('')

  return { publicKey, privateKey }
}

// AES encryption/decryption (simplified)
async function encryptWithSignature(data: string, signature: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(signature.slice(0, 32))

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  )

  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

async function decryptWithSignature(encryptedData: string, signature: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(signature.slice(0, 32))

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )

  return new TextDecoder().decode(decrypted)
}

// Helper function to map snake_case API response to camelCase UserProfile
function mapUserProfile(apiProfile: any): UserProfile | null {
  if (!apiProfile) return null
  
  return {
    username: apiProfile.username || '',
    ethAddress: apiProfile.eth_address || apiProfile.ethAddress || '',
    avatarUrl: apiProfile.avatar_url || apiProfile.avatarUrl || '',
    createdAt: apiProfile.created_at || apiProfile.createdAt || 0,
    lastActive: apiProfile.last_active || apiProfile.lastActive || 0,
    chessWins: apiProfile.chess_wins || apiProfile.chessWins || 0,
    chessLosses: apiProfile.chess_losses || apiProfile.chessLosses || 0,
    chessDraws: apiProfile.chess_draws || apiProfile.chessDraws || 0,
    chessElo: apiProfile.chess_elo || apiProfile.chessElo || 0,
    pokerWins: apiProfile.poker_wins || apiProfile.pokerWins || 0,
    pokerLosses: apiProfile.poker_losses || apiProfile.pokerLosses || 0,
    pokerChipsWon: apiProfile.poker_chips_won || apiProfile.pokerChipsWon || 0,
    pokerBestHand: apiProfile.poker_best_hand || apiProfile.pokerBestHand || '',
    blackjackWins: apiProfile.blackjack_wins || apiProfile.blackjackWins || 0,
    blackjackLosses: apiProfile.blackjack_losses || apiProfile.blackjackLosses || 0,
    blackjackPushes: apiProfile.blackjack_pushes || apiProfile.blackjackPushes || 0,
    blackjackChipsWon: apiProfile.blackjack_chips_won || apiProfile.blackjackChipsWon || 0,
    blackjackNaturals: apiProfile.blackjack_naturals || apiProfile.blackjackNaturals || 0,
    totalGames: apiProfile.total_games || apiProfile.totalGames || 0,
    currentStreak: apiProfile.current_streak || apiProfile.currentStreak || 0,
    bestStreak: apiProfile.best_streak || apiProfile.bestStreak || 0,
  }
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial State
      isConnected: false,
      ethAddress: null,
      lineraPublicKey: null,
      provider: null,
      signer: null,
      userProfile: null,
      isRegistered: false,
      isLoading: false,
      currentGame: null,
      activeGames: [],
      toast: null,

      // Connect MetaMask
      connectWallet: async () => {
        try {
          if (typeof window.ethereum === 'undefined') {
            get().showToast('Please install MetaMask', 'error')
            return false
          }

          set({ isLoading: true })

          // Request account access - this will prompt MetaMask popup
          const provider = new BrowserProvider(window.ethereum)

          // Force MetaMask to show the account selection popup
          await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
          const accounts = await provider.send('eth_requestAccounts', [])

          if (accounts.length === 0) {
            get().showToast('No accounts found', 'error')
            set({ isLoading: false })
            return false
          }

          const signer = await provider.getSigner()
          const address = await signer.getAddress()

          set({
            isConnected: true,
            ethAddress: address,
            provider,
            signer,
          })

          // Generate or load Linera wallet
          const lineraKey = await get().generateLineraWallet()
          if (lineraKey) {
            set({ lineraPublicKey: lineraKey })
          }

          // Check if user is registered on blockchain
          try {
            console.log('🔍 Checking if user exists for:', address)
            const data = await GameAPI.getUserByEthAddress(address)
            console.log('📦 Raw API response:', data)
            
            // Use camelCase field name
            const apiProfile = data?.userByEthAddress
            const userProfile = mapUserProfile(apiProfile)
            
            if (userProfile && userProfile.username) {
              console.log('✅ User exists on blockchain:', userProfile.username)
              set({
                userProfile: userProfile,
                isRegistered: true
              })
            } else {
              console.log('📝 User not found on blockchain - needs registration')
              set({ isRegistered: false })
            }
          } catch (e: any) {
            console.error('❌ Error checking user:', e)
            
            // Check persisted state - if we have a userProfile with matching address, user is registered
            const { userProfile: persistedProfile } = get()
            if (persistedProfile && persistedProfile.ethAddress?.toLowerCase() === address.toLowerCase()) {
              console.log('✅ Using persisted profile - user is registered:', persistedProfile.username)
              set({ 
                userProfile: persistedProfile,
                isRegistered: true 
              })
            } else {
              // IMPORTANT: Treat errors as "user doesn't exist"
              // This allows registration to proceed
              console.log('⚠️ Treating error as new user (will show registration)')
              set({ isRegistered: false })
            }
          }

          set({ isLoading: false })
          get().showToast('Wallet connected!', 'success')
          return true
        } catch (error: any) {
          console.error('Error connecting wallet:', error)
          set({ isLoading: false })
          // User rejected the request
          if (error.code === 4001) {
            get().showToast('Please connect your wallet to continue', 'info')
          } else {
            get().showToast('Failed to connect wallet', 'error')
          }
          return false
        }
      },

      // Disconnect wallet
      // NOTE: We DON'T clear userProfile and isRegistered - they persist so user doesn't need to re-register
      disconnectWallet: () => {
        set({
          isConnected: false,
          ethAddress: null,
          lineraPublicKey: null,
          provider: null,
          signer: null,
          // Keep userProfile and isRegistered - user remains registered even after disconnect
        })
        get().showToast('Wallet disconnected', 'info')
      },

      // Check existing connection
      checkWalletConnection: async () => {
        if (typeof window.ethereum !== 'undefined') {
          try {
            const provider = new BrowserProvider(window.ethereum)
            const accounts = await provider.listAccounts()

            if (accounts.length > 0) {
              const signer = await provider.getSigner()
              const address = await signer.getAddress()

              set({
                isConnected: true,
                ethAddress: address,
                provider,
                signer,
              })

              // Load Linera wallet
              const stored = localStorage.getItem(`linera_wallet_${address}`)
              if (stored) {
                const { publicKey } = JSON.parse(stored)
                set({ lineraPublicKey: publicKey })
              }

              // Check if user is registered (for reconnection)
              try {
                const data = await GameAPI.getUserByEthAddress(address)
                const apiProfile = data?.userByEthAddress
                const userProfile = mapUserProfile(apiProfile)
                
                if (userProfile && userProfile.username) {
                  console.log('✅ User found on blockchain:', userProfile.username)
                  set({
                    userProfile: userProfile,
                    isRegistered: true
                  })
                } else {
                  // Check if we have persisted profile for this address
                  const { userProfile: persistedProfile } = get()
                  if (persistedProfile && persistedProfile.ethAddress?.toLowerCase() === address.toLowerCase()) {
                    console.log('✅ Using persisted profile:', persistedProfile.username)
                    set({ 
                      userProfile: persistedProfile,
                      isRegistered: true 
                    })
                  }
                }
              } catch (e) {
                // Check persisted state
                const { userProfile: persistedProfile } = get()
                if (persistedProfile && persistedProfile.ethAddress?.toLowerCase() === address.toLowerCase()) {
                  console.log('✅ Using persisted profile (blockchain check failed):', persistedProfile.username)
                  set({ 
                    userProfile: persistedProfile,
                    isRegistered: true 
                  })
                } else {
                  console.log('User not registered or error checking:', e)
                }
              }
            }
          } catch (error) {
            console.log('No existing connection')
          }
        }
      },

      // Set user profile
      setUserProfile: (profile) => {
        set({ userProfile: profile, isRegistered: true })
      },

      // Refresh profile from blockchain
      refreshProfile: async () => {
        const { ethAddress } = get()
        if (!ethAddress) return

        try {
          console.log('🔄 Refreshing profile for:', ethAddress)
          const data = await GameAPI.getUserByEthAddress(ethAddress)
          console.log('📦 Refresh response:', data)
          
          // Use camelCase field name
          const apiProfile = data?.userByEthAddress
          const userProfile = mapUserProfile(apiProfile)
          
          if (userProfile && userProfile.username) {
            set({ userProfile: userProfile, isRegistered: true })
            console.log('✅ Profile refreshed:', userProfile.username)
          } else {
            console.log('📝 No profile found')
            set({ isRegistered: false })
          }
        } catch (e: any) {
          console.warn('⚠️ Failed to refresh profile:', e.message)
          // Don't change registration state on errors
          // This prevents redirect loops
        }
      },

      // Register user on blockchain
      registerUser: async (username: string) => {
        const { ethAddress, lineraPublicKey, showToast } = get()

        if (!ethAddress) {
          showToast('Please connect wallet first', 'error')
          return false
        }

        // Check if user is already registered on blockchain before allowing registration
        try {
          const data = await GameAPI.getUserByEthAddress(ethAddress)
          const apiProfile = data?.userByEthAddress
          const existingProfile = mapUserProfile(apiProfile)
          
          if (existingProfile && existingProfile.username) {
            showToast('You are already registered!', 'info')
            // Update state with existing profile
            set({ userProfile: existingProfile, isRegistered: true })
            return false
          }
        } catch (e) {
          // User doesn't exist, proceed with registration
          console.log('New user, proceeding with registration')
        }

        // If no linera key, generate one
        if (!lineraPublicKey) {
          const key = await get().generateLineraWallet()
          if (!key) {
            showToast('Failed to generate wallet key', 'error')
            return false
          }
        }

        try {
          set({ isLoading: true })

          console.log('Registering user on-chain:', { username, ethAddress })

          // Use GameAPI which has proper GraphQL variable handling
          await GameAPI.registerUser(username, ethAddress, '')

          // Wait a moment for the operation to be processed
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Refresh profile to get the on-chain data (this will update userProfile)
          await get().refreshProfile()
          
          // Ensure isRegistered is set to true after successful registration
          // Even if refreshProfile fails, we know registration succeeded
          const { userProfile: refreshedProfile } = get()
          if (refreshedProfile && refreshedProfile.username) {
            set({ isRegistered: true, userProfile: refreshedProfile })
          } else {
            // If refresh failed, create a basic profile object so user can proceed
            set({ 
              isRegistered: true,
              userProfile: {
                username: username,
                ethAddress: ethAddress,
                avatarUrl: '',
                createdAt: Date.now(),
                lastActive: Date.now(),
                chessWins: 0,
                chessLosses: 0,
                chessDraws: 0,
                chessElo: 1200,
                pokerWins: 0,
                pokerLosses: 0,
                pokerChipsWon: 0,
                pokerBestHand: '',
                blackjackWins: 0,
                blackjackLosses: 0,
                blackjackPushes: 0,
                blackjackChipsWon: 0,
                blackjackNaturals: 0,
                totalGames: 0,
                currentStreak: 0,
                bestStreak: 0,
              }
            })
          }

          set({ isLoading: false })
          showToast('Registration successful!', 'success')
          return true
        } catch (error: any) {
          console.error('Registration error:', error)
          set({ isLoading: false })
          showToast(error.message || 'Registration failed', 'error')
          return false
        }
      },

      // Update username
      updateUsername: async (username: string) => {
        const { ethAddress, userProfile, showToast } = get()

        if (!ethAddress || !userProfile) {
          showToast('Please connect wallet first', 'error')
          return false
        }

        try {
          set({ isLoading: true })

          // Use GameAPI which has proper GraphQL variable handling
          await GameAPI.updateProfile(username, userProfile.avatarUrl)

          // Wait a moment for the operation to be processed
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Refresh profile to get the on-chain data
          await get().refreshProfile()

          set({ isLoading: false })
          showToast('Username updated!', 'success')
          return true
        } catch (error: any) {
          console.error('Update username error:', error)
          set({ isLoading: false })
          showToast(error.message || 'Update failed', 'error')
          return false
        }
      },

      // Generate Linera wallet
      generateLineraWallet: async () => {
        const { ethAddress, signer } = get()

        if (!ethAddress || !signer) return null

        const storageKey = `linera_wallet_${ethAddress}`
        const existing = localStorage.getItem(storageKey)

        if (existing) {
          try {
            const { publicKey } = JSON.parse(existing)
            return publicKey
          } catch {
            // Invalid stored data, regenerate
          }
        }

        try {
          // Generate new keypair
          const { publicKey, privateKey } = generateKeyPair()

          // Sign message to create encryption key
          const message = 'Sign to encrypt your ChainGames wallet'
          const signature = await signer.signMessage(message)

          // Encrypt private key
          const encryptedPrivateKey = await encryptWithSignature(privateKey, signature)

          // Store encrypted wallet
          localStorage.setItem(storageKey, JSON.stringify({
            publicKey,
            encryptedPrivateKey,
            createdAt: Date.now()
          }))

          return publicKey
        } catch (error) {
          console.error('Error generating Linera wallet:', error)
          return null
        }
      },

      // Game actions
      setCurrentGame: (game) => set({ currentGame: game }),
      setActiveGames: (games) => set({ activeGames: games }),

      // Toast actions
      showToast: (message, type) => {
        set({ toast: { message, type } })
        setTimeout(() => set({ toast: null }), 4000)
      },
      hideToast: () => set({ toast: null }),
    }),
    {
      name: 'chaingames-store',
      partialize: (state) => ({
        ethAddress: state.ethAddress,
        lineraPublicKey: state.lineraPublicKey,
        userProfile: state.userProfile,
        isRegistered: state.isRegistered,
      }),
    }
  )
)

// Declare ethereum on window
declare global {
  interface Window {
    ethereum?: any
  }
}
