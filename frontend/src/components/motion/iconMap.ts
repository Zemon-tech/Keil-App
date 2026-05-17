import {
  Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee,
  Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail,
  Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle,
  AlertCircle, XCircle, Clock, Zap, FileText, Sparkles,
  Home, Folder, FolderOpen, File, FilePlus, FileCheck, FileX, FileSearch,
  Archive, Inbox, Send, MessageSquare, MessageCircle, Phone, PhoneCall,
  Video, Monitor, Laptop, Smartphone, Tablet, Watch, Tv, Speaker,
  Headphones, Mic, Volume2, VolumeX, Radio, Wifi, WifiOff, Bluetooth,
  Battery, BatteryCharging, Power, Plug, Cpu, HardDrive, Server,
  Globe, Link, ExternalLink, Download, Upload, Share, Share2, Copy,
  Clipboard, ClipboardCheck, Scissors, Edit, Edit2, Edit3, Pencil, PenTool,
  Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Table, Grid, Columns, Rows, Maximize, Minimize,
  Eye, EyeOff, Lock, Unlock, Key, LogIn, LogOut, UserPlus, UserMinus,
  UserCheck, UserX, Award, Trophy, Medal, Crown, Gem, Diamond,
  Rocket, Flame, Droplet, Wind, Snowflake, CloudRain, CloudSnow, Umbrella,
  Sunrise, Sunset, ThermometerSun, TreePine, Mountain, Waves,
  Compass, Navigation, MapPin, Anchor, Ship, Car, Bus, Train,
  Bike, Footprints,
  Building, Building2, Store, Warehouse, Church, School, Hospital,
  Banknote, CreditCard, Wallet, ShoppingCart, ShoppingBag, Package, Truck,
  Box, Tag, Tags, Percent, Receipt, BarChart, BarChart2,
  PieChart, TrendingUp, TrendingDown, Activity,
  HeartPulse, Stethoscope, Pill, Syringe, TestTube, Microscope,
  Dna, Brain, Bone, Apple, Cherry, Grape, Citrus,
  Sandwich, Pizza, CakeSlice, IceCream, Cookie, Croissant, Egg, Fish,
  Beef, Soup, UtensilsCrossed, ChefHat, Wine, Beer, CupSoda, Milk,
  Palette, Paintbrush, Brush, Eraser, Ruler, Triangle, Circle, Square,
  Hexagon, Pentagon, Octagon, Hash, AtSign, Asterisk,
  Plus, Minus, X, Check, ChevronRight, ChevronDown, ChevronUp, ChevronLeft,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, RotateCcw, RefreshCw,
  Repeat, Shuffle, Play, Pause, SkipForward, SkipBack, FastForward, Rewind,
  Image, Aperture, Focus, ScanLine, QrCode, Fingerprint,
  Bug, Wrench, Hammer, Cog, SlidersHorizontal, ToggleLeft,
  Lightbulb, Lamp, Flashlight,
  Book, BookOpen, BookMarked, Library, GraduationCap, Backpack, Notebook,
  Newspaper, Scroll, FileSpreadsheet, Presentation, ClipboardList,
  CalendarDays, CalendarCheck, CalendarClock, AlarmClock, Timer, Hourglass,
  Gamepad2, Dice1, Dice5, Joystick, Puzzle, Blocks,
  Dog, Cat, Bird, Rabbit, Squirrel, Turtle, Snail,
  Flower, Flower2, Clover, Leaf, Sprout, Vegan,
  HandMetal, ThumbsUp, ThumbsDown, Handshake, Hand,
  Smile, Frown, Meh, Angry, Laugh, PartyPopper,
  Ghost, Skull, Bot, PersonStanding,
  Target, Crosshair, Swords, ShieldAlert, ShieldCheck, ShieldOff,
  Tent, Axe,
  Piano, Guitar, Drum, Music2, Music3, Music4,
  Clapperboard, Film, Popcorn, Ticket,
  Glasses,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Master icon map used across the app for resolving "lucide:IconName" strings
export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Plane, Heart, Star, Cloud, Moon, Sun, Bell, Camera, Gift, Coffee,
  Music, Code, Terminal, Database, Shield, Layout, Settings, User, Users, Mail,
  Map, Flag, Bookmark, Calendar, CheckCircle, HelpCircle, Info, AlertTriangle,
  AlertCircle, XCircle, Clock, Zap, FileText, Sparkles,
  Home, Folder, FolderOpen, File, FilePlus, FileCheck, FileX, FileSearch,
  Archive, Inbox, Send, MessageSquare, MessageCircle, Phone, PhoneCall,
  Video, Monitor, Laptop, Smartphone, Tablet, Watch, Tv, Speaker,
  Headphones, Mic, Volume2, VolumeX, Radio, Wifi, WifiOff, Bluetooth,
  Battery, BatteryCharging, Power, Plug, Cpu, HardDrive, Server,
  Globe, Link, ExternalLink, Download, Upload, Share, Share2, Copy,
  Clipboard, ClipboardCheck, Scissors, Edit, Edit2, Edit3, Pencil, PenTool,
  Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Table, Grid, Columns, Rows, Maximize, Minimize,
  Eye, EyeOff, Lock, Unlock, Key, LogIn, LogOut, UserPlus, UserMinus,
  UserCheck, UserX, Award, Trophy, Medal, Crown, Gem, Diamond,
  Rocket, Flame, Droplet, Wind, Snowflake, CloudRain, CloudSnow, Umbrella,
  Sunrise, Sunset, ThermometerSun, TreePine, Mountain, Waves,
  Compass, Navigation, MapPin, Anchor, Ship, Car, Bus, Train,
  Bike, Footprints,
  Building, Building2, Store, Warehouse, Church, School, Hospital,
  Banknote, CreditCard, Wallet, ShoppingCart, ShoppingBag, Package, Truck,
  Box, Tag, Tags, Percent, Receipt, BarChart, BarChart2,
  PieChart, TrendingUp, TrendingDown, Activity,
  HeartPulse, Stethoscope, Pill, Syringe, TestTube, Microscope,
  Dna, Brain, Bone, Apple, Cherry, Grape, Citrus,
  Sandwich, Pizza, CakeSlice, IceCream, Cookie, Croissant, Egg, Fish,
  Beef, Soup, UtensilsCrossed, ChefHat, Wine, Beer, CupSoda, Milk,
  Palette, Paintbrush, Brush, Eraser, Ruler, Triangle, Circle, Square,
  Hexagon, Pentagon, Octagon, Hash, AtSign, Asterisk,
  Plus, Minus, X, Check, ChevronRight, ChevronDown, ChevronUp, ChevronLeft,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, RotateCcw, RefreshCw,
  Repeat, Shuffle, Play, Pause, SkipForward, SkipBack, FastForward, Rewind,
  Image, Aperture, Focus, ScanLine, QrCode, Fingerprint,
  Bug, Wrench, Hammer, Cog, SlidersHorizontal, ToggleLeft,
  Lightbulb, Lamp, Flashlight,
  Book, BookOpen, BookMarked, Library, GraduationCap, Backpack, Notebook,
  Newspaper, Scroll, FileSpreadsheet, Presentation, ClipboardList,
  CalendarDays, CalendarCheck, CalendarClock, AlarmClock, Timer, Hourglass,
  Gamepad2, Dice1, Dice5, Joystick, Puzzle, Blocks,
  Dog, Cat, Bird, Rabbit, Squirrel, Turtle, Snail,
  Flower, Flower2, Clover, Leaf, Sprout, Vegan,
  HandMetal, ThumbsUp, ThumbsDown, Handshake, Hand,
  Smile, Frown, Meh, Angry, Laugh, PartyPopper,
  Ghost, Skull, Bot, PersonStanding,
  Target, Crosshair, Swords, ShieldAlert, ShieldCheck, ShieldOff,
  Tent, Axe,
  Piano, Guitar, Drum, Music2, Music3, Music4,
  Clapperboard, Film, Popcorn, Ticket,
  Glasses,
};

// Categorized icon list for the picker UI
export const ICON_CATEGORIES: { name: string; icons: string[] }[] = [
  {
    name: "Common",
    icons: ["Home", "Star", "Heart", "Bookmark", "Flag", "Zap", "Sparkles", "Rocket", "Flame", "Lightbulb", "Target", "Award", "Trophy", "Crown", "Gem", "Diamond", "Medal", "ThumbsUp", "PartyPopper", "Smile"],
  },
  {
    name: "Files & Folders",
    icons: ["FileText", "File", "FilePlus", "FileCheck", "FileX", "FileSearch", "FileSpreadsheet", "Folder", "FolderOpen", "Archive", "Clipboard", "ClipboardCheck", "ClipboardList", "Notebook", "Book", "BookOpen", "BookMarked", "Library", "Newspaper", "Scroll", "Presentation"],
  },
  {
    name: "Communication",
    icons: ["Mail", "Send", "Inbox", "MessageSquare", "MessageCircle", "Phone", "PhoneCall", "Video", "Globe", "Share", "Share2", "Link", "ExternalLink", "AtSign"],
  },
  {
    name: "Media",
    icons: ["Music", "Music2", "Music3", "Music4", "Piano", "Guitar", "Drum", "Headphones", "Mic", "Volume2", "VolumeX", "Radio", "Speaker", "Play", "Pause", "SkipForward", "SkipBack", "FastForward", "Rewind", "Shuffle", "Repeat", "Image", "Camera", "Aperture", "Film", "Clapperboard", "Popcorn", "Ticket"],
  },
  {
    name: "Dev & Tech",
    icons: ["Code", "Terminal", "Database", "Server", "Cpu", "HardDrive", "Monitor", "Laptop", "Smartphone", "Tablet", "Tv", "Wifi", "WifiOff", "Bluetooth", "Bug", "Wrench", "Hammer", "Cog", "SlidersHorizontal", "ToggleLeft", "QrCode", "Fingerprint", "Bot"],
  },
  {
    name: "Design & Edit",
    icons: ["Palette", "Paintbrush", "Brush", "Eraser", "PenTool", "Pencil", "Edit", "Edit2", "Edit3", "Ruler", "Type", "Bold", "Italic", "Underline", "AlignLeft", "AlignCenter", "AlignRight", "Scissors", "Copy", "Grid", "Layout", "Columns", "Rows"],
  },
  {
    name: "People",
    icons: ["User", "Users", "UserPlus", "UserMinus", "UserCheck", "UserX", "PersonStanding", "GraduationCap", "Backpack", "Hand", "HandMetal", "Handshake", "Footprints"],
  },
  {
    name: "Nature & Weather",
    icons: ["Sun", "Moon", "Cloud", "CloudRain", "CloudSnow", "Snowflake", "Wind", "Droplet", "Umbrella", "Sunrise", "Sunset", "ThermometerSun", "TreePine", "Mountain", "Waves", "Flower", "Flower2", "Clover", "Leaf", "Sprout", "Vegan"],
  },
  {
    name: "Animals",
    icons: ["Dog", "Cat", "Bird", "Rabbit", "Squirrel", "Turtle", "Snail", "Fish", "Bone"],
  },
  {
    name: "Food & Drink",
    icons: ["Apple", "Cherry", "Grape", "Citrus", "Sandwich", "Pizza", "CakeSlice", "IceCream", "Cookie", "Croissant", "Egg", "Beef", "Soup", "UtensilsCrossed", "ChefHat", "Wine", "Beer", "CupSoda", "Milk", "Coffee"],
  },
  {
    name: "Travel & Places",
    icons: ["Plane", "Car", "Bus", "Train", "Bike", "Ship", "Anchor", "Compass", "Navigation", "MapPin", "Map", "Building", "Building2", "Store", "Warehouse", "Church", "School", "Hospital", "Tent"],
  },
  {
    name: "Business",
    icons: ["Banknote", "CreditCard", "Wallet", "ShoppingCart", "ShoppingBag", "Package", "Truck", "Box", "Tag", "Tags", "Percent", "Receipt", "BarChart", "BarChart2", "PieChart", "TrendingUp", "TrendingDown", "Activity"],
  },
  {
    name: "Health & Science",
    icons: ["HeartPulse", "Stethoscope", "Pill", "Syringe", "TestTube", "Microscope", "Dna", "Brain"],
  },
  {
    name: "Time",
    icons: ["Clock", "Calendar", "CalendarDays", "CalendarCheck", "CalendarClock", "AlarmClock", "Timer", "Hourglass", "Watch"],
  },
  {
    name: "Security",
    icons: ["Shield", "ShieldAlert", "ShieldCheck", "ShieldOff", "Lock", "Unlock", "Key", "Eye", "EyeOff", "LogIn", "LogOut", "Swords", "Crosshair"],
  },
  {
    name: "Shapes & Symbols",
    icons: ["Circle", "Square", "Triangle", "Hexagon", "Pentagon", "Octagon", "Hash", "Asterisk", "Plus", "Minus", "X", "Check"],
  },
  {
    name: "Arrows & Navigation",
    icons: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ChevronUp", "ChevronDown", "ChevronLeft", "ChevronRight", "RotateCw", "RotateCcw", "RefreshCw", "Download", "Upload", "Maximize", "Minimize"],
  },
  {
    name: "Faces & Fun",
    icons: ["Smile", "Frown", "Meh", "Angry", "Laugh", "Ghost", "Skull", "Gamepad2", "Dice1", "Dice5", "Joystick", "Puzzle", "Blocks", "Glasses"],
  },
];

// Flat list of all icon names for random selection
export const ALL_ICON_NAMES = Object.keys(LUCIDE_ICON_MAP);

// Resolve a lucide icon name to its component
export function resolveLucideIcon(name: string): LucideIcon {
  return LUCIDE_ICON_MAP[name] || FileText;
}
