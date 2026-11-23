class Env:
  def reset(self,seed=None,options=None):
    import numpy as np; self.np_random=np.random.default_rng(seed)
class _S:
  def Box(self,*a,**k): return None
  def Discrete(self,*a,**k): return None

